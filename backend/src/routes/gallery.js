import { Router } from 'express';
import crypto from 'node:crypto';
import { col, getSetting, now } from '../db.js';
import { HttpError, requireAdmin, requireSuperAdmin } from '../auth.js';
import { logActivity } from '../activity.js';

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
 *   POST   /add-uploads   add every photo uploaded for menu items that isn't in the gallery yet,
 *                     named after the item using it; the same photo uploaded twice is added once
 *                     (super admin; the console does this when the gallery is opened)
 *
 * An upload counts as handled (`galleryChecked` on the image) once it is in the gallery or was
 * skipped as a repeat, so a photo deleted from the gallery doesn't come back.
 */
const router = Router();

export const GALLERY_CATEGORIES = ['Ice Cream Flavours', 'Specialty Coffee', 'Artisan Cakes', 'Brand Signatures'];

const HIDDEN_KEY = 'gallery_hidden';

router.get('/', requireAdmin, async (req, res) => {
  const [photos, hidden, waiting] = await Promise.all([
    col('gallery').find({}, { projection: { _id: 0, sha256: 0 } }).sort({ createdAt: -1 }).toArray(),
    getSetting(HIDDEN_KEY),
    col('images').countDocuments({ galleryChecked: { $ne: true } }),
  ]);
  // `waiting`: uploads (menu photos) not in the gallery yet
  res.json({ photos, hidden: hidden || [], waiting });
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
  const image = await col('images').findOneAndUpdate({ id: url.split('/').pop() }, { $set: { galleryChecked: true } }, { projection: { sha256: 1 } });
  // The same picture uploaded again: keep the one already in the gallery
  const same = image?.sha256 && (await col('gallery').findOne({ sha256: image.sha256 }, { projection: { _id: 0, sha256: 0 } }));
  if (same) return res.json({ photo: same, alreadyInGallery: true });
  await col('gallery').insertOne({ ...photo, ...(image?.sha256 && { sha256: image.sha256 }) });
  await logActivity(req, { category: 'gallery', summary: `added the photo “${photo.name}” to the gallery` });
  res.status(201).json({ photo });
});

router.delete('/:id', requireSuperAdmin, async (req, res) => {
  const id = String(req.params.id);
  if (id.startsWith('gal_')) {
    const photo = await col('gallery').findOneAndDelete({ id });
    if (!photo) throw new HttpError(404, 'Photo not found');
    await logActivity(req, { category: 'gallery', summary: `deleted the photo “${photo.name}” from the gallery` });
    return res.json({ deleted: true });
  }
  // One of Amore's own photos (built into the website): hide it from the gallery
  if (!/^[a-z0-9-]{2,60}$/.test(id)) throw new HttpError(404, 'Photo not found');
  await col('settings').updateOne({ key: HIDDEN_KEY }, { $addToSet: { value: id } }, { upsert: true });
  await logActivity(req, { category: 'gallery', summary: `deleted one of Amore’s own photos (${id}) from the gallery` });
  res.json({ deleted: true, hidden: true });
});

const CATEGORY_FOR = { scoop: 'Ice Cream Flavours', coffee: 'Specialty Coffee', cake: 'Artisan Cakes' };
const BRANCH_NAMES = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };

router.post('/add-uploads', requireSuperAdmin, async (req, res) => {
  const [menu, existing, uploads] = await Promise.all([
    col('menu_items').find({ isDeleted: { $ne: true } }, { projection: { _id: 0, name: 1, itemType: 1, image: 1, coneImage: 1, branchOverrides: 1 } }).toArray(),
    col('gallery').find({}, { projection: { _id: 0, url: 1, sha256: 1 } }).toArray(),
    col('images').find({ galleryChecked: { $ne: true } }, { projection: { _id: 0, id: 1, sha256: 1, createdAt: 1 } }).sort({ createdAt: 1 }).toArray(),
  ]);
  if (!uploads.length) return res.json({ added: 0 });

  // What each upload is used for on the menu: "Mango (Alphonso)", "Durian – waffle cone", "Durian – Colombo"
  const uses = new Map();
  for (const m of menu) {
    const use = (url, name) => {
      if (typeof url === 'string' && url.startsWith('/api/images/') && !uses.has(url)) {
        uses.set(url, { name: name.slice(0, 80), category: CATEGORY_FOR[m.itemType] || 'Ice Cream Flavours' });
      }
    };
    use(m.image, m.name || 'Menu photo');
    use(m.coneImage, `${m.name || 'Menu photo'} – waffle cone`);
    for (const [b, own] of Object.entries(m.branchOverrides || {})) {
      use(own.image, `${own.name || m.name || 'Menu photo'} – ${BRANCH_NAMES[b] || b}`);
      use(own.coneImage, `${own.name || m.name || 'Menu photo'} – ${BRANCH_NAMES[b] || b}, waffle cone`);
    }
  }

  // Older uploads have no fingerprint yet: work it out from the photo once and keep it
  for (const u of uploads.filter((x) => !x.sha256)) {
    const image = await col('images').findOne({ id: u.id }, { projection: { data: 1 } });
    if (!image) continue;
    u.sha256 = crypto.createHash('sha256').update(Buffer.from(image.data.buffer)).digest('hex');
    await col('images').updateOne({ id: u.id }, { $set: { sha256: u.sha256 } });
  }

  // One gallery photo per different picture: the copy the menu uses if any, else the newest
  const inGallery = new Set(existing.flatMap((g) => [g.url, g.sha256]).filter(Boolean));
  const groups = new Map();
  for (const u of uploads) {
    if (!u.sha256) continue;
    groups.set(u.sha256, [...(groups.get(u.sha256) || []), u]);
  }
  const photos = [];
  for (const [sha256, copies] of groups) {
    if (inGallery.has(sha256) || copies.some((c) => inGallery.has(`/api/images/${c.id}`))) continue;
    const pick = copies.find((c) => uses.has(`/api/images/${c.id}`)) || copies[copies.length - 1];
    const url = `/api/images/${pick.id}`;
    const day = new Date(pick.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const { name, category } = uses.get(url) || { name: `Uploaded photo (${day})`, category: 'Ice Cream Flavours' };
    photos.push({ id: `gal_${crypto.randomBytes(8).toString('hex')}`, url, name, category, sha256, createdAt: pick.createdAt || now(), uploadedBy: req.admin.username });
  }
  if (photos.length) await col('gallery').insertMany(photos);
  await col('images').updateMany({ id: { $in: uploads.map((u) => u.id) } }, { $set: { galleryChecked: true } });
  if (photos.length) {
    await logActivity(req, { category: 'gallery', summary: `added ${photos.length} photo${photos.length === 1 ? '' : 's'} uploaded for menu items to the gallery` });
  }
  res.json({ added: photos.length, skipped: uploads.length - photos.length });
});

router.post('/restore', requireSuperAdmin, async (req, res) => {
  await col('settings').updateOne({ key: HIDDEN_KEY }, { $set: { value: [] } }, { upsert: true });
  await logActivity(req, { category: 'gallery', summary: 'restored Amore’s own photos in the gallery' });
  res.json({ restored: true });
});

export default router;
