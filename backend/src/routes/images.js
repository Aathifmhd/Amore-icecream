import express, { Router } from 'express';
import crypto from 'node:crypto';
import { Binary } from 'mongodb';
import { col, now } from '../db.js';
import { HttpError, requireAdmin } from '../auth.js';

/*
 * Menu photos uploaded from the admin console. The browser shrinks them to at most
 * 1200 px first, so they are small enough to keep in MongoDB.
 * A photo never changes once uploaded (a new one gets a new id), so it can be cached forever.
 */
const router = Router();

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

router.post('/', requireAdmin, express.raw({ type: TYPES, limit: '4mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new HttpError(415, 'Send the photo as a JPEG, PNG, WebP or GIF file');
  }
  const id = crypto.randomBytes(12).toString('hex');
  await col('images').insertOne({
    id,
    contentType: req.get('content-type').split(';')[0].trim().toLowerCase(),
    size: req.body.length,
    data: new Binary(req.body),
    uploadedBy: req.admin.username,
    createdAt: now(),
  });
  res.status(201).json({ id, url: `/api/images/${id}` });
});

router.get('/:id', async (req, res) => {
  if (!/^[a-f0-9]{24}$/.test(req.params.id)) throw new HttpError(404, 'Photo not found');
  const image = await col('images').findOne({ id: req.params.id });
  if (!image) throw new HttpError(404, 'Photo not found');
  res.set({
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': image.contentType,
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(Buffer.from(image.data.buffer));
});

export default router;
