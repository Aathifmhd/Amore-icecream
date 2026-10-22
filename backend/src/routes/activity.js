import { Router } from 'express';
import { col } from '../db.js';
import { BRANCHES, requireSuperAdmin } from '../auth.js';
import { ACTIVITY_CATEGORIES } from '../activity.js';

/*
 * Action Center (super admin): what happened across the branches, newest first.
 *   GET /?before=&category=&branch=&limit=   a page of entries
 *   GET /count?after=                        how many came in since (not counting your own)
 */
const router = Router();
router.use(requireSuperAdmin);

const validDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

router.get('/', async (req, res) => {
  const { before, category, branch } = req.query;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const filter = {
    ...(validDate(before) && { at: { $lt: before } }),
    ...(ACTIVITY_CATEGORIES.includes(category) && { category }),
    ...(BRANCHES.includes(branch) && { branchId: branch }),
  };
  const items = await col('activity')
    .find(filter, { projection: { _id: 0, atDate: 0 } })
    .sort({ at: -1 })
    .limit(limit + 1)
    .toArray();
  res.json({ items: items.slice(0, limit), more: items.length > limit });
});

router.get('/count', async (req, res) => {
  const { after } = req.query;
  if (!validDate(after)) return res.json({ count: 0 });
  const count = await col('activity').countDocuments({ at: { $gt: after }, 'actor.username': { $ne: req.admin.username } });
  res.json({ count });
});

export default router;
