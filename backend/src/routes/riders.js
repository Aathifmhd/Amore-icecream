import { Router } from 'express';
import crypto from 'node:crypto';
import { col, now, PUBLIC } from '../db.js';
import { BRANCHES, HttpError, adminBranch, phoneKey, publicRider, requireAdmin, riderPinFields } from '../auth.js';
import { branchName, logActivity, lkr } from '../activity.js';
import { collectsCash, readyQuery, riderOrderView, startOfTodayColombo } from '../riderOrders.js';
import { cashByRider } from '../riderCash.js';
import { ratingSummary } from '../riderRatings.js';

/*
 * Riders, managed from the console (a branch admin: their own parlour's riders).
 *
 *   GET    /                    riders with what they are doing now and today, + orders waiting for a rider
 *   GET    /:id/deliveries      a rider's latest deliveries
 *   POST   /                    { name, phone, branchId, pin } add a rider
 *   PATCH  /:id                 { name?, phone?, branchId?, active?, pin? } (a new PIN or switching off signs them out)
 *   DELETE /:id                 remove a rider (not while they are out with orders or hold cash)
 */
const router = Router();
router.use(requireAdmin);

const scope = (req) => {
  const branch = adminBranch(req.admin);
  return branch ? { branchId: branch } : {};
};

async function findRider(req) {
  const rider = await col('riders').findOne({ id: req.params.id, ...scope(req) });
  if (!rider) throw new HttpError(404, 'Rider not found');
  return rider;
}

const cleanName = (v) => {
  const name = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 60) throw new HttpError(400, 'Give the rider a name (2–60 letters)');
  return name;
};
const cleanPhone = (v) => {
  const phone = typeof v === 'string' ? v.trim() : '';
  if (phoneKey(phone).length !== 9 || phone.length > 20) throw new HttpError(400, 'Enter the rider’s mobile number, e.g. 077 123 4567');
  return phone;
};
const cleanBranch = (req, v) => {
  const own = adminBranch(req.admin);
  if (own) return own;
  if (!BRANCHES.includes(v)) throw new HttpError(400, 'Choose the rider’s parlour');
  return v;
};
const phoneTaken = async (phone, exceptId) => {
  const other = await col('riders').findOne({ phoneKey: phoneKey(phone), ...(exceptId && { id: { $ne: exceptId } }) });
  if (other) throw new HttpError(409, `${other.name} already uses this phone number`);
};

router.get('/', async (req, res) => {
  const riders = await col('riders').find(scope(req)).sort({ name: 1 }).toArray();
  const ids = riders.map((r) => r.id);
  const today = startOfTodayColombo();
  const branches = adminBranch(req.admin) ? [adminBranch(req.admin)] : BRANCHES;
  const [active, waiting, cash, ratings] = await Promise.all([
    col('orders')
      .find({ riderId: { $in: ids }, $or: [{ status: 'on_the_way' }, { status: 'delivered', deliveredAt: { $gte: today } }] }, PUBLIC)
      .toArray(),
    col('orders').find({ $or: branches.map((b) => readyQuery(b)) }, PUBLIC).sort({ readyAt: 1 }).toArray(),
    cashByRider(ids),
    ratingSummary(ids),
  ]);
  res.json({
    riders: riders.map((r) => {
      const mine = active.filter((o) => o.riderId === r.id);
      const out = mine.filter((o) => o.status === 'on_the_way');
      const done = mine.filter((o) => o.status === 'delivered');
      return {
        ...publicRider(r),
        outWith: out.map((o) => ({ orderReference: o.orderReference, customerName: o.customerName, city: o.city, onTheWayAt: o.onTheWayAt, grandTotalLKR: o.grandTotalLKR, collectCash: collectsCash(o) })),
        deliveredToday: done.length,
        cashToday: done.reduce((s, o) => s + (o.cashCollectedLKR || 0), 0),
        // Cash still with the rider: collected today and on its way back
        cashOnTheWay: out.filter(collectsCash).reduce((s, o) => s + (o.grandTotalLKR || 0), 0),
        // Cash from delivered orders not yet handed in at the parlour (Cash collection page)
        holdingLKR: cash[r.id].holdingLKR,
        rating: ratings[r.id],
      };
    }),
    waiting: waiting.map(riderOrderView),
    serverTime: now(),
  });
});

router.get('/:id/deliveries', async (req, res) => {
  const rider = await findRider(req);
  const orders = await col('orders')
    .find({ riderId: rider.id, status: { $in: ['on_the_way', 'delivered'] } }, PUBLIC)
    .sort({ onTheWayAt: -1 })
    .limit(60)
    .toArray();
  res.json({ rider: publicRider(rider), deliveries: orders.map(riderOrderView) });
});

router.post('/', async (req, res) => {
  const { name, phone, branchId, pin } = req.body || {};
  const rider = {
    id: `rdr_${crypto.randomBytes(8).toString('hex')}`,
    name: cleanName(name),
    phone: cleanPhone(phone),
    branchId: cleanBranch(req, branchId),
    active: true,
    sessionVersion: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  rider.phoneKey = phoneKey(rider.phone);
  await phoneTaken(rider.phone);
  Object.assign(rider, await riderPinFields(pin));
  await col('riders').insertOne({ ...rider });
  await logActivity(req, { category: 'riders', summary: `added ${rider.name} as a rider for ${branchName(rider.branchId)}`, branchId: rider.branchId });
  res.status(201).json({ rider: publicRider(rider) });
});

router.patch('/:id', async (req, res) => {
  const rider = await findRider(req);
  const body = req.body || {};
  const set = { updatedAt: now() };
  const said = [];
  if (body.name !== undefined) set.name = cleanName(body.name);
  if (body.phone !== undefined) {
    set.phone = cleanPhone(body.phone);
    set.phoneKey = phoneKey(set.phone);
    await phoneTaken(set.phone, rider.id);
  }
  if (body.branchId !== undefined && !adminBranch(req.admin)) {
    set.branchId = cleanBranch(req, body.branchId);
    if (set.branchId !== rider.branchId) said.push(`moved to ${branchName(set.branchId)}`);
  }
  let signOut = false;
  if (body.pin !== undefined) {
    Object.assign(set, await riderPinFields(body.pin));
    said.push('set a new PIN');
    signOut = true;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw new HttpError(400, 'Say whether the rider is active');
    if (!body.active && (await col('orders').countDocuments({ riderId: rider.id, status: 'on_the_way' }))) {
      throw new HttpError(409, `${rider.name} is out with orders. Mark them delivered or handed back first.`);
    }
    set.active = body.active;
    if (body.active !== (rider.active !== false)) said.push(body.active ? 'switched on' : 'switched off');
    if (!body.active) signOut = true;
  }
  await col('riders').updateOne({ id: rider.id }, { $set: set, ...(signOut && { $inc: { sessionVersion: 1 } }) });
  const after = await col('riders').findOne({ id: rider.id });
  const what = said.length ? said.join(', ') : 'updated the details';
  await logActivity(req, { category: 'riders', summary: `rider ${after.name}: ${what}`, branchId: after.branchId });
  res.json({ rider: publicRider(after) });
});

router.delete('/:id', async (req, res) => {
  const rider = await findRider(req);
  if (await col('orders').countDocuments({ riderId: rider.id, status: 'on_the_way' })) {
    throw new HttpError(409, `${rider.name} is out with orders. Mark them delivered or handed back first.`);
  }
  const { holdingLKR } = (await cashByRider([rider.id]))[rider.id];
  if (holdingLKR > 0) throw new HttpError(409, `${rider.name} still holds ${lkr(holdingLKR)} cash. Receive it on the Cash collection page first.`);
  await col('riders').deleteOne({ id: rider.id });
  await logActivity(req, { category: 'riders', summary: `removed the rider ${rider.name} (${branchName(rider.branchId)})`, branchId: rider.branchId });
  res.json({ deleted: true });
});

export default router;
