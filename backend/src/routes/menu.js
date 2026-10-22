import { Router } from 'express';
import { col, now } from '../db.js';
import { BRANCHES, HttpError, adminBranch, requireAdmin, requireSuperAdmin } from '../auth.js';
import { branchName, logActivity } from '../activity.js';

/*
 * The built-in menu ships with the website (frontend/src/data/iceCreamData.ts).
 * This collection only holds the admin's changes on top of it: edited or added items
 * (with `itemType` scoop / coffee / cake) and `isDeleted` markers for removed ones.
 *
 * Stock is kept per branch: `soldOutAt` lists the branches where an item is sold out.
 * (`isAvailable: false` from before then meant sold out everywhere.)
 *
 * The super admin's version of an item is the standard for every branch. A branch can use
 * its own prices, photos and text: `branchOverrides.<branch>` holds only what differs.
 * Branch admins change their own branch's version and stock; only the super admin adds,
 * removes or edits the standard item.
 */
const router = Router();

const ITEM_TYPES = ['scoop', 'coffee', 'cake'];
const MAX_ITEM_BYTES = 50_000;
// Fields an item save never touches: stock has its own route, so saving an item can't undo a branch's switch
const NOT_SAVED = ['_id', 'id', 'isDeleted', 'soldOutAt', 'isAvailable', 'branchOverrides'];

// What a branch may change for itself, and how each value is checked
const text = (max) => (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const photo = (v) => typeof v === 'string' && v.length <= 2000 && !v.startsWith('data:');
const price = (v) => Number.isInteger(v) && v >= 0 && v <= 1_000_000;
const OVERRIDE_FIELDS = {
  name: text(80),
  tagline: text(200),
  description: text(1500),
  portionOrTemp: text(80),
  image: photo,
  coneImage: photo,
  conePriceLKR: price,
  biscuitCupPriceLKR: price,
  doubleConePriceLKR: price,
  doubleCupPriceLKR: price,
  priceLKR: price,
};
const FIELD_LABEL = {
  conePriceLKR: 'cone',
  biscuitCupPriceLKR: 'cup',
  doubleConePriceLKR: 'double cone',
  doubleCupPriceLKR: 'double cup',
  priceLKR: 'price',
};

/** The branch this admin may change the menu for. */
function editableBranch(req, branchId) {
  if (!BRANCHES.includes(branchId)) throw new HttpError(400, 'Choose a branch');
  const own = adminBranch(req.admin);
  if (own && own !== branchId) throw new HttpError(403, 'You can only change the menu for your own branch');
  return branchId;
}

function checkId(id) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new HttpError(400, 'Invalid item id');
  return id;
}

router.get('/', async (req, res) => {
  const items = await col('menu_items').find({}, { projection: { _id: 0 } }).toArray();
  res.set('Cache-Control', 'no-store');
  res.json({ items, serverTime: now() });
});

// Save an item (creates it, or merges the changes into an existing one)
router.put('/:id', requireSuperAdmin, async (req, res) => {
  const id = checkId(req.params.id);
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Expected a JSON object');
  if (Buffer.byteLength(JSON.stringify(body)) > MAX_ITEM_BYTES) {
    throw new HttpError(413, 'This item is too large. Upload the photo instead of pasting it.');
  }
  if (body.itemType !== undefined && !ITEM_TYPES.includes(body.itemType)) throw new HttpError(400, 'Invalid itemType');

  const fields = {};
  for (const [key, value] of Object.entries(body)) {
    if (NOT_SAVED.includes(key) || key.startsWith('$') || key.includes('.')) continue;
    if (value !== undefined) fields[key] = value;
  }
  const before = await col('menu_items').findOne({ id }, { projection: { _id: 0, name: 1, isDeleted: 1 } });
  const item = await col('menu_items').findOneAndUpdate(
    { id },
    // Saving an item again brings it back if it had been deleted
    { $set: { ...fields, id, updatedAt: now() }, $unset: { isDeleted: '' } },
    { upsert: true, returnDocument: 'after', projection: { _id: 0 } }
  );
  const name = item.name || id;
  // Built-in items have no record until first edited, so "added" is judged by the id the console gives new items
  const isNew = !before && /-\d{10,}$/.test(id);
  await logActivity(req, { category: 'menu', summary: isNew ? `added ${name} to the menu` : `edited ${name} on the menu` });
  res.json({ item });
});

// In stock / sold out at one branch
router.put('/:id/stock', requireAdmin, async (req, res) => {
  const id = checkId(req.params.id);
  const { branchId, inStock, itemType, itemName } = req.body || {};
  if (!BRANCHES.includes(branchId)) throw new HttpError(400, 'Choose a branch');
  if (typeof inStock !== 'boolean') throw new HttpError(400, 'Say whether the item is in stock');
  if (!ITEM_TYPES.includes(itemType)) throw new HttpError(400, 'Invalid itemType');
  const own = adminBranch(req.admin);
  if (own && own !== branchId) throw new HttpError(403, 'You can only change stock for your own branch');

  // An item sold out everywhere the old way becomes sold out at each branch, then this branch changes
  const existing = await col('menu_items').findOne({ id });
  if (existing?.isAvailable === false) {
    await col('menu_items').updateOne({ id }, { $set: { soldOutAt: BRANCHES }, $unset: { isAvailable: '' } });
  }
  const item = await col('menu_items').findOneAndUpdate(
    { id },
    {
      [inStock ? '$pull' : '$addToSet']: { soldOutAt: branchId },
      $set: { updatedAt: now() },
      $setOnInsert: { id, itemType },
    },
    { upsert: true, returnDocument: 'after', projection: { _id: 0 } }
  );
  const name = item.name || (typeof itemName === 'string' && itemName.trim().slice(0, 100)) || id;
  await logActivity(req, {
    category: 'stock',
    summary: inStock ? `put ${name} back in stock at ${branchName(branchId)}` : `marked ${name} sold out at ${branchName(branchId)}`,
    branchId,
  });
  res.json({ item });
});

// A branch's own version of an item: { fields: {...only what differs}, itemType, itemName }
router.put('/:id/branch/:branchId', requireAdmin, async (req, res) => {
  const id = checkId(req.params.id);
  const branchId = editableBranch(req, req.params.branchId);
  const { fields, itemType, itemName } = req.body || {};
  if (!ITEM_TYPES.includes(itemType)) throw new HttpError(400, 'Invalid itemType');
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new HttpError(400, 'Expected the changed fields');

  const clean = {};
  for (const [key, value] of Object.entries(fields)) {
    const check = OVERRIDE_FIELDS[key];
    if (!check) throw new HttpError(400, `${key} can't be changed per branch`);
    if (!check(value)) throw new HttpError(400, `Invalid value for ${key}`);
    clean[key] = typeof value === 'string' ? value.trim() : value;
  }

  const path = `branchOverrides.${branchId}`;
  const update = Object.keys(clean).length
    ? { $set: { [path]: { ...clean, updatedAt: now(), updatedBy: req.admin.username }, updatedAt: now() }, $setOnInsert: { id, itemType } }
    : { $unset: { [path]: '' }, $set: { updatedAt: now() }, $setOnInsert: { id, itemType } };
  const item = await col('menu_items').findOneAndUpdate({ id }, update, { upsert: true, returnDocument: 'after', projection: { _id: 0 } });

  const name = clean.name || item.name || (typeof itemName === 'string' && itemName.trim().slice(0, 100)) || id;
  const prices = Object.keys(FIELD_LABEL).filter((k) => k in clean).map((k) => `${FIELD_LABEL[k]} LKR ${clean[k].toLocaleString('en-US')}`);
  const other = [
    (clean.image || clean.coneImage) && 'photo',
    (clean.name || clean.tagline || clean.description || clean.portionOrTemp) && 'text',
  ].filter(Boolean);
  const what = [prices.length && `prices: ${prices.join(' · ')}`, ...other].filter(Boolean).join(', ');
  await logActivity(req, {
    category: 'menu',
    summary: what ? `set ${branchName(branchId)}'s own ${name} (${what})` : `set ${name} back to the standard menu at ${branchName(branchId)}`,
    branchId,
  });
  res.json({ item });
});

// Back to the standard version at this branch
router.delete('/:id/branch/:branchId', requireAdmin, async (req, res) => {
  const id = checkId(req.params.id);
  const branchId = editableBranch(req, req.params.branchId);
  const existing = await col('menu_items').findOne({ id }, { projection: { _id: 0, name: 1 } });
  await col('menu_items').updateOne({ id }, { $unset: { [`branchOverrides.${branchId}`]: '' }, $set: { updatedAt: now() } });
  const name = existing?.name || (typeof req.query.name === 'string' && req.query.name.trim().slice(0, 100)) || id;
  await logActivity(req, { category: 'menu', summary: `set ${name} back to the standard menu at ${branchName(branchId)}`, branchId });
  res.json({ ok: true });
});

// Delete: keep a marker so every device drops the item (it may be one of the built-in ones)
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  const id = checkId(req.params.id);
  const existing = await col('menu_items').findOne({ id }, { projection: { _id: 0, name: 1 } });
  await col('menu_items').updateOne({ id }, { $set: { id, isDeleted: true, updatedAt: now() } }, { upsert: true });
  const name = existing?.name || (typeof req.query.name === 'string' && req.query.name.trim().slice(0, 100)) || id;
  await logActivity(req, { category: 'menu', summary: `removed ${name} from the menu` });
  res.json({ deleted: true });
});

export default router;
