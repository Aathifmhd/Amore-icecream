import { Router } from 'express';
import crypto from 'node:crypto';
import { col, getSetting, now } from '../db.js';
import { HttpError, requireAdmin, requireSuperAdmin } from '../auth.js';

/*
 * The photo gallery that menu photos are picked from. Amore's own photos ship with the
 * website (CATALOG_PRESET_IMAGES); this collection holds the ones the super admin uploads.
 * The file itself is stored by /api/images; a gallery entry names and files it.
 * Deleting one of Amore's own photos hides it (the `gallery_hidden` setting lists them).
 *
 *   GET    /          uploaded photos + the hidden built-in ones (admins)
 *   POST   /          { url, name, category }  add one (super admin)
 *   DELETE /:id       delete an uploaded photo, or hide a built-in one (super admin;
 *                     menu items already using the photo keep it)
 *   POST   /restore   bring back every hidden built-in photo (super admin)
 */
const router = Router();

export const GALLERY_CATEGORIES = ['Ice Cream Flavours', 'Specialty Coffee', 'Artisan Cakes', 'Brand Signatures'];

const HIDDEN_KEY = 'gallery_hidden';

router.get('/', requireAdmin, async (req, res) => {
  const [photos, hidden] = await Promise.all([
    col('gallery').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(),
    getSetting(HIDDEN_KEY),
  ]);
  res.json({ photos, hidden: hidden || [] });
});

router.post('/', requireSuperAdmin, async (req, res) => {
  const { url, name, category } = req.body || {};
  if (typeof url !== 'string' || !/^\/api\/images\/[a-f0-9]{24}$/.test(url)) throw new HttpError(400, 'Upload the photo first');
  if (!(await col('images').findOne({ id: url.split('/').pop() }, { projection: { _id: 1 } }))) {
    throw new HttpError(400, 'That photo was not found. Please upload it again.');
  }
  const title = typeof name === 'string' ? name.trim() : '';
  if (!title || title.length > 80) throw new HttpError(400, 'Give the photo a name (up to 80 characters)');
  if (!GALLERY_CATEGORIES.includes(category)) throw new HttpError(400, 'Choose a category');
  const photo = { id: `gal_${crypto.randomBytes(8).toString('hex')}`, url, name: title, category, createdAt: now(), uploadedBy: req.admin.username };
  await col('gallery').insertOne({ ...photo });
  res.status(201).json({ photo });
});

router.delete('/:id', requireSuperAdmin, async (req, res) => {
  const id = String(req.params.id);
  if (id.startsWith('gal_')) {
    const { deletedCount } = await col('gallery').deleteOne({ id });
    if (!deletedCount) throw new HttpError(404, 'Photo not found');
    return res.json({ deleted: true });
  }
  // One of Amore's own photos (built into the website): hide it from the gallery
  if (!/^[a-z0-9-]{2,60}$/.test(id)) throw new HttpError(404, 'Photo not found');
  await col('settings').updateOne({ key: HIDDEN_KEY }, { $addToSet: { value: id } }, { upsert: true });
  res.json({ deleted: true, hidden: true });
});

router.post('/restore', requireSuperAdmin, async (req, res) => {
  await col('settings').updateOne({ key: HIDDEN_KEY }, { $set: { value: [] } }, { upsert: true });
  res.json({ restored: true });
});

export default router;
