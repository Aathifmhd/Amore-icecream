import { Router } from 'express';
import crypto from 'node:crypto';
import { col, now } from '../db.js';
import { HttpError, requireAdmin, requireSuperAdmin } from '../auth.js';

/*
 * The photo gallery that menu photos are picked from. Amore's own photos ship with the
 * website (CATALOG_PRESET_IMAGES); this collection holds the ones the super admin uploads.
 * The file itself is stored by /api/images; a gallery entry names and files it.
 *
 *   GET    /      every uploaded gallery photo (admins)
 *   POST   /      { url, name, category }  add one (super admin)
 *   DELETE /:id   take it out of the gallery (super admin; menu items using it keep it)
 */
const router = Router();

export const GALLERY_CATEGORIES = ['Ice Cream Flavours', 'Specialty Coffee', 'Artisan Cakes', 'Brand Signatures'];

router.get('/', requireAdmin, async (req, res) => {
  const photos = await col('gallery').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
  res.json({ photos });
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
  const { deletedCount } = await col('gallery').deleteOne({ id: String(req.params.id) });
  if (!deletedCount) throw new HttpError(404, 'Photo not found');
  res.json({ deleted: true });
});

export default router;
