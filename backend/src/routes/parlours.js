import { Router } from 'express';
import { now } from '../db.js';
import { BRANCHES, HttpError, requireSuperAdmin } from '../auth.js';
import { branchName, logActivity } from '../activity.js';
import { distanceKm, getParlours, saveParlour } from '../parlours.js';

/*
 * Parlour locations and delivery ranges.
 *
 *   GET /        every parlour: { lat, lng, radiusKm } (everyone; the website draws them on the map)
 *   PUT /:id     { lat, lng, radiusKm }  move a parlour or change how far it delivers (super admin)
 */
const router = Router();

router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ parlours: await getParlours() });
});

// Sri Lanka, with some room: catches swapped or mistyped numbers
const inSriLanka = (lat, lng) => lat >= 5.5 && lat <= 10.5 && lng >= 79 && lng <= 82.5;

router.put('/:id', requireSuperAdmin, async (req, res) => {
  const id = req.params.id;
  if (!BRANCHES.includes(id)) throw new HttpError(404, 'No such parlour');
  const { lat, lng, radiusKm } = req.body || {};
  if (![lat, lng, radiusKm].every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw new HttpError(400, 'Give the location as numbers and the delivery distance in km');
  }
  if (!inSriLanka(lat, lng)) throw new HttpError(400, 'That location is not in Sri Lanka. Check the numbers (latitude first, then longitude).');
  if (radiusKm < 0.5 || radiusKm > 50) throw new HttpError(400, 'The delivery distance must be between 0.5 and 50 km');

  const before = (await getParlours())[id];
  const value = {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    radiusKm: Math.round(radiusKm * 10) / 10,
    updatedAt: now(),
    updatedBy: req.admin.username,
  };
  await saveParlour(id, value);

  // "moved Akurana parlour on the map (120 m) and set its delivery range to 8 km"
  const moved = distanceKm(before, value);
  const parts = [];
  if (moved >= 0.005) parts.push(`moved ${branchName(id)} parlour on the map (${moved < 1 ? `${Math.round(moved * 1000)} m` : `${moved.toFixed(1)} km`})`);
  if (value.radiusKm !== before.radiusKm) parts.push(`${parts.length ? 'set its' : `set ${branchName(id)}'s`} delivery range to ${value.radiusKm} km`);
  if (parts.length) await logActivity(req, { category: 'parlours', summary: parts.join(' and '), branchId: id });

  res.json({ parlours: await getParlours() });
});

export default router;
