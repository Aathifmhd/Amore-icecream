import { Router } from 'express';
import { col, now } from '../db.js';
import { BRANCHES, HttpError, adminBranch, requireAdmin, requireSuperAdmin } from '../auth.js';

/*
 * The built-in menu ships with the website (frontend/src/data/iceCreamData.ts).
 * This collection only holds the admin's changes on top of it: edited or added items
 * (with `itemType` scoop / coffee / cake) and `isDeleted` markers for removed ones.
 *
 * Stock is kept per branch: `soldOutAt` lists the branches where an item is sold out.
 * (`isAvailable: false` from before then meant sold out everywhere.)
 * Only the super admin edits items; each branch admin switches stock for their own branch.
 */
const router = Router();

const ITEM_TYPES = ['scoop', 'coffee', 'cake'];
const MAX_ITEM_BYTES = 50_000;
// Fields an item save never touches: stock has its own route, so saving an item can't undo a branch's switch
const NOT_SAVED = ['_id', 'id', 'isDeleted', 'soldOutAt', 'isAvailable'];

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
  const item = await col('menu_items').findOneAndUpdate(
    { id },
    // Saving an item again brings it back if it had been deleted
    { $set: { ...fields, id, updatedAt: now() }, $unset: { isDeleted: '' } },
    { upsert: true, returnDocument: 'after', projection: { _id: 0 } }
  );
  res.json({ item });
});

// In stock / sold out at one branch
router.put('/:id/stock', requireAdmin, async (req, res) => {
  const id = checkId(req.params.id);
  const { branchId, inStock, itemType } = req.body || {};
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
  res.json({ item });
});

// Delete: keep a marker so every device drops the item (it may be one of the built-in ones)
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  const id = checkId(req.params.id);
  await col('menu_items').updateOne({ id }, { $set: { id, isDeleted: true, updatedAt: now() } }, { upsert: true });
  res.json({ deleted: true });
});

export default router;
