import { Router } from 'express';
import { col, now, PUBLIC } from '../db.js';
import { HttpError, adminBranch, requireAdmin, requireCustomer } from '../auth.js';
import { newCustomerOrder, newAdminOrder, orderUpdate, checkDelete, isRefundRecord } from '../orderRules.js';
import { logActivity, lkr } from '../activity.js';

const router = Router();

/** What a change to an order means, for the Action Center (null for small things like the grace timer). */
function describeOrderChange(before, after, req) {
  const ref = after.orderReference;
  const pickup = after.orderType === 'pickup';
  if (before.status !== after.status) {
    switch (after.status) {
      case 'confirmed':
      case 'paid':
        return ['order', `accepted order ${ref}`];
      case 'preparing':
        return ['order', `started preparing order ${ref}`];
      case 'on_the_way':
        return ['order', pickup ? `marked order ${ref} ready for pickup` : `sent order ${ref} out for delivery`];
      case 'delivered':
        return ['order', pickup ? `marked order ${ref} as collected` : `marked order ${ref} as delivered`];
      case 'cancelled': {
        const why = after.cancellationReason ? ` — ${after.cancellationReason}` : '';
        return ['order', `cancelled order ${ref}${why}`];
      }
      default:
        return ['order', `changed order ${ref} to ${after.status}`];
    }
  }
  if (before.refundStatus !== 'completed' && after.refundStatus === 'completed') {
    return ['refund', `paid the refund for ${ref} (${lkr(after.refundAmountLKR ?? after.grandTotalLKR)})`];
  }
  const changed = Object.keys(req.body || {}).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  const quiet = ['updatedAt', 'createdAt', 'isGracePeriodPaused', 'gracePeriodRemainingSeconds', 'gracePeriodPausedAt', 'customerDeletedHistory', 'inconvenienceEmailContent'];
  const meaningful = changed.filter((k) => !quiet.includes(k));
  if (!meaningful.length) return null;
  if (isRefundRecord(after)) return ['refund', `edited the refund record ${ref}`];
  return ['order', req.admin ? `edited order ${ref}` : `changed the delivery details of order ${ref}`];
}

// A customer may place this many orders in 10 minutes
const ORDER_BURST_LIMIT = 10;

/**
 * Changes are read with `?since=<serverTime of the previous read>`. Reads look a little
 * further back than asked so a write that finished during the previous read isn't missed;
 * the browser just sees those few orders twice.
 */
function sinceFilter(since) {
  const t = Date.parse(since || '');
  return Number.isNaN(t) ? null : new Date(t - 10_000).toISOString();
}

// Branch admins only ever see their own branch's orders
const scope = (req) => {
  const branch = adminBranch(req.admin);
  return branch ? { branchId: branch } : {};
};

/** An order this admin may see, or 404 (a branch admin isn't told other branches' orders exist). */
async function findForAdmin(req, ref) {
  const order = await findOrder(ref);
  const branch = adminBranch(req.admin);
  if (branch && order.branchId !== branch) throw new HttpError(404, 'Order not found');
  return order;
}

/** Items in the order that the branch has marked sold out (or that were taken off the menu). */
async function unavailableItems(order) {
  const ids = [...new Set(order.items.map((i) => i.itemId))];
  const docs = await col('menu_items')
    .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, name: 1, isDeleted: 1, isAvailable: 1, soldOutAt: 1 } })
    .toArray();
  return docs
    .filter((d) => d.isDeleted || d.isAvailable === false || d.soldOutAt?.includes(order.branchId))
    .map((d) => d.name || order.items.find((i) => i.itemId === d.id)?.name || d.id);
}

// Admin: every order (or the ones changed since the last read) plus the ones deleted
router.get('/', requireAdmin, async (req, res) => {
  const serverTime = now();
  const since = sinceFilter(req.query.since);
  const [orders, deleted] = await Promise.all([
    col('orders').find({ ...scope(req), ...(since && { _syncedAt: { $gt: since } }) }, PUBLIC).toArray(),
    col('deleted_orders')
      .find({ ...scope(req), ...(since && { deletedAt: { $gt: since } }) }, { projection: { _id: 0, orderReference: 1 } })
      .sort({ deletedAt: -1 })
      .limit(5000)
      .toArray(),
  ]);
  res.json({ orders, deleted: deleted.map((d) => d.orderReference), serverTime, full: !since });
});

// Customer: their own orders
router.get('/mine', requireCustomer, async (req, res) => {
  const orders = await col('orders')
    .find({ userId: req.customer.uid }, PUBLIC)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  res.json({ orders, serverTime: now() });
});

async function findOrder(ref) {
  const order = await col('orders').findOne({ orderReference: ref }, PUBLIC);
  if (!order) throw new HttpError(404, 'Order not found');
  return order;
}

// One order: admins, or the customer who placed it
router.get('/:ref', async (req, res) => {
  if (!req.admin && !req.customer) throw new HttpError(401, 'Please sign in first');
  const order = req.admin ? await findForAdmin(req, req.params.ref) : await findOrder(req.params.ref);
  if (!req.admin && order.userId !== req.customer.uid) throw new HttpError(403, 'This is not your order');
  res.json({ order, serverTime: now() });
});

router.post('/', async (req, res) => {
  if (!req.admin && !req.customer) throw new HttpError(401, 'Please sign in to place an order');
  const order = req.admin ? newAdminOrder(req.body) : newCustomerOrder(req.body, req.customer);

  const branch = adminBranch(req.admin);
  if (branch && order.branchId !== branch) throw new HttpError(403, 'You can only add orders for your own branch');

  if (!req.admin) {
    const soldOut = await unavailableItems(order);
    if (soldOut.length) {
      throw new HttpError(409, `Sorry, ${soldOut.join(', ')} ${soldOut.length === 1 ? 'is' : 'are'} sold out at Amore ${order.branchName || order.branchId} right now. Please remove ${soldOut.length === 1 ? 'it' : 'them'} from your tray.`, { soldOut });
    }
    const recent = await col('orders').countDocuments({
      userId: req.customer.uid,
      _placedAt: { $gt: new Date(Date.now() - 10 * 60_000).toISOString() },
    });
    if (recent >= ORDER_BURST_LIMIT) throw new HttpError(429, 'Too many orders in a short time. Please call the parlour.');
  }

  const stamp = now();
  try {
    await col('orders').insertOne({ ...order, _syncedAt: stamp, _placedAt: stamp });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'An order with this reference already exists');
    throw err;
  }
  // A reference can be reused after a delete; it is a live order again
  await col('deleted_orders').deleteOne({ orderReference: order.orderReference });
  const what = req.admin
    ? isRefundRecord(order)
      ? ['refund', `added a refund record ${order.orderReference} for ${order.customerName} (${lkr(order.refundAmountLKR ?? order.grandTotalLKR)})`]
      : ['order', `added order ${order.orderReference} for ${order.customerName} · ${lkr(order.grandTotalLKR)}`]
    : ['order', `placed a new online order ${order.orderReference} · ${lkr(order.grandTotalLKR)} (${order.orderType})`];
  await logActivity(req, { category: what[0], summary: what[1], branchId: order.branchId, ref: order.orderReference });
  res.status(201).json({ order, serverTime: stamp });
});

router.patch('/:ref', async (req, res) => {
  if (!req.admin && !req.customer) throw new HttpError(401, 'Please sign in first');
  const existing = req.admin ? await findForAdmin(req, req.params.ref) : await findOrder(req.params.ref);
  const branch = adminBranch(req.admin);
  if (branch && req.body?.branchId !== undefined && req.body.branchId !== branch) {
    throw new HttpError(403, 'You can only keep orders in your own branch');
  }
  const update = orderUpdate(req.body, existing, { admin: req.admin, customer: req.customer });
  const stamp = now();
  const order = await col('orders').findOneAndUpdate(
    { orderReference: existing.orderReference },
    { ...update, $set: { ...update.$set, _syncedAt: stamp } },
    { returnDocument: 'after', ...PUBLIC }
  );
  const what = describeOrderChange(existing, order, req);
  if (what) await logActivity(req, { category: what[0], summary: what[1], branchId: order.branchId, ref: order.orderReference });
  res.json({ order, serverTime: now() });
});

router.delete('/:ref', async (req, res) => {
  if (!req.admin && !req.customer) throw new HttpError(401, 'Please sign in first');
  const existing = await col('orders').findOne({ orderReference: req.params.ref, ...scope(req) }, PUBLIC);
  if (!existing) return res.json({ deleted: false, serverTime: now() });
  checkDelete(existing, { admin: req.admin, customer: req.customer });
  const stamp = now();
  await col('orders').deleteOne({ orderReference: existing.orderReference });
  await col('deleted_orders').updateOne(
    { orderReference: existing.orderReference },
    { $set: { orderReference: existing.orderReference, branchId: existing.branchId, deletedAt: stamp } },
    { upsert: true }
  );
  await logActivity(req, { category: 'order', summary: `deleted order ${existing.orderReference}`, branchId: existing.branchId });
  res.json({ deleted: true, serverTime: now() });
});

export default router;
