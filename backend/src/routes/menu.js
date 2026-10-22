import { Router } from 'express';
import { col, now } from '../db.js';
import { HttpError, requireAdmin } from '../auth.js';

/*
 * The built-in menu ships with the website (frontend/src/data/iceCreamData.ts).
 * This collection only holds the admin's changes on top of it: edited or added items
 * (with `itemType` scoop / coffee / cake) and `isDeleted` markers for removed ones.
 */
const router = Router();

const ITEM_TYPES = ['scoop', 'coffee', 'cake'];
const MAX_ITEM_BYTES = 50_000;

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
router.put('/:id', requireAdmin, async (req, res) => {
  const id = checkId(req.params.id);
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Expected a JSON object');
  if (Buffer.byteLength(JSON.stringify(body)) > MAX_ITEM_BYTES) {
    throw new HttpError(413, 'This item is too large. Upload the photo instead of pasting it.');
  }
  if (body.itemType !== undefined && !ITEM_TYPES.includes(body.itemType)) throw new HttpError(400, 'Invalid itemType');

  const fields = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === '_id' || key === 'id' || key === 'isDeleted' || key.startsWith('$') || key.includes('.')) continue;
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

// Delete: keep a marker so every device drops the item (it may be one of the built-in ones)
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = checkId(req.params.id);
  await col('menu_items').updateOne({ id }, { $set: { id, isDeleted: true, updatedAt: now() } }, { upsert: true });
  res.json({ deleted: true });
});

export default router;
