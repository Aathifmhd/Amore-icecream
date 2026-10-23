import { Router } from 'express';
import crypto from 'node:crypto';
import { col, now } from '../db.js';
import { HttpError, adminBranch, requireAdmin } from '../auth.js';
import { actorOf, logActivity, lkr } from '../activity.js';
import { cashByRider, earlierDays, handInView, unpaidCashOrders } from '../riderCash.js';
import { startOfTodayColombo } from '../riderOrders.js';

/*
 * Cash collection (console): the cash each rider holds from cash-on-delivery orders, and
 * recording what they hand in at the parlour. A branch admin sees their own parlour's riders.
 *
 *   GET    /                  every rider's cash (holding, today, still held from earlier days), and the latest hand-ins
 *   GET    /:riderId          the deliveries whose cash a rider still holds, and their hand-ins
 *   POST   /:riderId/hand-in  { amountLKR, note? } cash received from the rider
 *   DELETE /hand-ins/:id      undo a hand-in recorded by mistake (same day only)
 */
const router = Router();
router.use(requireAdmin);

const scope = (req) => {
  const branch = adminBranch(req.admin);
  return branch ? { branchId: branch } : {};
};

async function findRider(req) {
  const rider = await col('riders').findOne({ id: req.params.riderId, ...scope(req) });
  if (!rider) throw new HttpError(404, 'Rider not found');
  return rider;
}

router.get('/', async (req, res) => {
  const riders = await col('riders').find(scope(req)).sort({ name: 1 }).toArray();
  const cash = await cashByRider(riders.map((r) => r.id));
  // Which deliveries make up what each rider holds (only riders holding cash)
  const unpaid = Object.fromEntries(
    await Promise.all(riders.filter((r) => cash[r.id].holdingLKR > 0).map(async (r) => [r.id, await unpaidCashOrders(r.id, cash[r.id].holdingLKR)]))
  );
  const handIns = await col('cash_handins').find(scope(req)).sort({ receivedAt: -1 }).limit(40).toArray();
  res.json({
    riders: riders.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      branchId: r.branchId,
      active: r.active !== false,
      ...cash[r.id],
      unpaidOrders: unpaid[r.id]?.length || 0,
      holdingSince: unpaid[r.id]?.[0]?.deliveredAt || null,
      // Cash from deliveries before today that hasn't been handed in, by day
      earlier: earlierDays(unpaid[r.id] || []),
    })),
    handIns: handIns.map(handInView),
    today: startOfTodayColombo(),
    serverTime: now(),
  });
});

router.get('/:riderId', async (req, res) => {
  const rider = await findRider(req);
  const [cash, handIns] = await Promise.all([
    cashByRider([rider.id]),
    col('cash_handins').find({ riderId: rider.id }).sort({ receivedAt: -1 }).limit(20).toArray(),
  ]);
  const orders = await unpaidCashOrders(rider.id, cash[rider.id].holdingLKR);
  res.json({ rider: { id: rider.id, name: rider.name, branchId: rider.branchId }, ...cash[rider.id], orders, handIns: handIns.map(handInView), today: startOfTodayColombo() });
});

router.post('/:riderId/hand-in', async (req, res) => {
  const rider = await findRider(req);
  const amount = Number(req.body?.amountLKR);
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 200) : '';
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount) !== amount) throw new HttpError(400, 'Enter the amount received in rupees');
  const { holdingLKR } = (await cashByRider([rider.id]))[rider.id];
  if (holdingLKR <= 0) throw new HttpError(409, `${rider.name} has no cash to hand in`);
  if (amount > holdingLKR) throw new HttpError(400, `${rider.name} only holds ${lkr(holdingLKR)}`);
  const actor = actorOf(req);
  const handIn = {
    id: `cash_${crypto.randomBytes(8).toString('hex')}`,
    riderId: rider.id,
    riderName: rider.name,
    branchId: rider.branchId,
    amountLKR: amount,
    holdingBeforeLKR: holdingLKR,
    note,
    receivedAt: now(),
    receivedBy: { username: actor.username, name: actor.name },
  };
  await col('cash_handins').insertOne({ ...handIn });
  const left = holdingLKR - amount;
  await logActivity(req, {
    category: 'riders',
    summary: `received ${lkr(amount)} cash from ${rider.name}${left ? ` · ${lkr(left)} still to hand in` : ''}${note ? ` — ${note}` : ''}`,
    branchId: rider.branchId,
  });
  res.status(201).json({ handIn: handInView(handIn), holdingLKR: left });
});

router.delete('/hand-ins/:id', async (req, res) => {
  const handIn = await col('cash_handins').findOne({ id: req.params.id, ...scope(req) });
  if (!handIn) throw new HttpError(404, 'Hand-in not found');
  if (handIn.receivedAt < startOfTodayColombo()) throw new HttpError(409, 'Only today’s hand-ins can be undone');
  await col('cash_handins').deleteOne({ id: handIn.id });
  await logActivity(req, { category: 'riders', summary: `undid the cash hand-in of ${lkr(handIn.amountLKR)} from ${handIn.riderName}`, branchId: handIn.branchId });
  res.json({ deleted: true });
});

export default router;
