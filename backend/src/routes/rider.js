import { Router } from 'express';
import { col, now, PUBLIC } from '../db.js';
import { HttpError, publicRider, requireRider, riderLogin } from '../auth.js';
import { logActivity, lkr } from '../activity.js';
import { collectsCash, readyQuery, riderOrderView, startOfTodayColombo } from '../riderOrders.js';

/*
 * The rider app (amore-icecream.vercel.app/rider).
 *
 *   POST /login                 { phone, pin } → rider session
 *   GET  /me                    the signed-in rider
 *   GET  /orders                ready to pick up at my parlour, mine on the way, my deliveries today
 *   POST /orders/:ref/pickup    take a ready order (only one rider can)
 *   POST /orders/:ref/delivered { cashCollected } hand it over at the door
 *   POST /orders/:ref/hand-back { reason } couldn't deliver: it goes back to the parlour's ready list
 */
const router = Router();

router.post('/login', async (req, res) => {
  const { phone, pin } = req.body || {};
  if (typeof phone !== 'string' || typeof pin !== 'string' || !phone.trim() || !pin) {
    throw new HttpError(400, 'Enter your phone number and PIN');
  }
  const session = await riderLogin(phone, pin);
  await logActivity({ rider: session.rider }, { category: 'riders', summary: 'signed in to the rider app', branchId: session.rider.branchId });
  res.json(session);
});

router.use(requireRider);

// Keep "last seen" fresh for the console (at most once a minute)
router.use(async (req, res, next) => {
  const seen = Date.parse(req.rider.lastSeenAt || '') || 0;
  if (Date.now() - seen > 60_000) await col('riders').updateOne({ id: req.rider.id }, { $set: { lastSeenAt: now() } });
  next();
});

router.get('/me', (req, res) => res.json({ rider: publicRider(req.rider) }));

router.get('/orders', async (req, res) => {
  const r = req.rider;
  const [ready, mine, done, upcoming] = await Promise.all([
    col('orders').find(readyQuery(r.branchId), PUBLIC).sort({ readyAt: 1 }).toArray(),
    col('orders').find({ riderId: r.id, status: 'on_the_way' }, PUBLIC).sort({ onTheWayAt: 1 }).toArray(),
    col('orders')
      .find({ riderId: r.id, status: 'delivered', deliveredAt: { $gte: startOfTodayColombo() } }, PUBLIC)
      .sort({ deliveredAt: -1 })
      .toArray(),
    // Deliveries being made now: they will be ready soon
    col('orders').countDocuments({
      branchId: r.branchId,
      orderType: 'delivery',
      status: { $in: ['confirmed', 'paid', 'preparing'] },
      readyAt: { $in: [null, ''] },
    }),
  ]);
  res.json({
    rider: publicRider(r),
    ready: ready.map(riderOrderView),
    mine: mine.map(riderOrderView),
    done: done.map(riderOrderView),
    upcoming,
    serverTime: now(),
  });
});

const findMine = async (req) => {
  const order = await col('orders').findOne({ orderReference: req.params.ref, riderId: req.rider.id }, PUBLIC);
  if (!order) throw new HttpError(404, 'This order is not with you');
  return order;
};

router.post('/orders/:ref/pickup', async (req, res) => {
  const r = req.rider;
  const t = now();
  const order = await col('orders').findOneAndUpdate(
    { orderReference: req.params.ref, ...readyQuery(r.branchId) },
    {
      $set: { status: 'on_the_way', onTheWayAt: t, riderId: r.id, riderName: r.name, riderPhone: r.phone, updatedAt: t, _syncedAt: t },
      $unset: { riderNote: '' },
    },
    { returnDocument: 'after', ...PUBLIC }
  );
  if (!order) {
    const current = await col('orders').findOne({ orderReference: req.params.ref }, { projection: { riderId: 1, riderName: 1, status: 1 } });
    if (current?.riderId && current.riderId !== r.id) throw new HttpError(409, `${current.riderName || 'Another rider'} already picked up this order`);
    if (current?.riderId === r.id) throw new HttpError(409, 'You already have this order');
    throw new HttpError(409, 'This order is not ready for pickup any more');
  }
  const cash = collectsCash(order) ? ` · collect ${lkr(order.grandTotalLKR)}` : '';
  await logActivity(req, { category: 'riders', summary: `picked up order ${order.orderReference}${cash}`, branchId: order.branchId, ref: order.orderReference });
  res.json({ order: riderOrderView(order), serverTime: t });
});

router.post('/orders/:ref/delivered', async (req, res) => {
  const existing = await findMine(req);
  if (existing.status !== 'on_the_way') throw new HttpError(409, 'This order is not out for delivery');
  const cash = collectsCash(existing);
  if (cash && req.body?.cashCollected !== true) {
    throw new HttpError(400, `Confirm that you collected ${lkr(existing.grandTotalLKR)} in cash`);
  }
  const t = now();
  const order = await col('orders').findOneAndUpdate(
    { orderReference: existing.orderReference, riderId: req.rider.id, status: 'on_the_way' },
    {
      $set: {
        status: 'delivered',
        deliveredAt: t,
        paidAt: existing.paidAt || t,
        ...(cash && { cashCollectedLKR: existing.grandTotalLKR }),
        updatedAt: t,
        _syncedAt: t,
      },
    },
    { returnDocument: 'after', ...PUBLIC }
  );
  if (!order) throw new HttpError(409, 'This order changed. Pull down to refresh.');
  const summary = cash ? `delivered order ${order.orderReference} · collected ${lkr(order.grandTotalLKR)} cash` : `delivered order ${order.orderReference}`;
  await logActivity(req, { category: 'riders', summary, branchId: order.branchId, ref: order.orderReference });
  res.json({ order: riderOrderView(order), serverTime: t });
});

router.post('/orders/:ref/hand-back', async (req, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 200) : '';
  if (reason.length < 3) throw new HttpError(400, 'Say why you are handing the order back');
  const existing = await findMine(req);
  if (existing.status !== 'on_the_way') throw new HttpError(409, 'This order is not out for delivery');
  const t = now();
  const order = await col('orders').findOneAndUpdate(
    { orderReference: existing.orderReference, riderId: req.rider.id, status: 'on_the_way' },
    {
      $set: { status: 'preparing', readyAt: existing.readyAt || t, riderNote: `${req.rider.name}: ${reason}`, updatedAt: t, _syncedAt: t },
      $unset: { riderId: '', riderName: '', riderPhone: '', onTheWayAt: '' },
    },
    { returnDocument: 'after', ...PUBLIC }
  );
  if (!order) throw new HttpError(409, 'This order changed. Pull down to refresh.');
  await logActivity(req, { category: 'riders', summary: `handed back order ${order.orderReference} — ${reason}`, branchId: order.branchId, ref: order.orderReference });
  res.json({ order: riderOrderView(order), serverTime: t });
});

export default router;
