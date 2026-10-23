import { col } from './db.js';
import { colomboDay, startOfTodayColombo } from './riderOrders.js';

/*
 * Cash riders collect at the door and hand in at the parlour.
 *
 * What a rider holds = all the cash they collected (delivered orders' cashCollectedLKR)
 *                    − everything they handed in (the `cash_handins` collection).
 * A hand-in can be part of what they hold; the rest stays with them. The oldest deliveries
 * count as paid first, so the console can show which orders are still to be handed in.
 */

const cashOrders = (riderIds) => ({ riderId: { $in: riderIds }, status: 'delivered', cashCollectedLKR: { $gt: 0 } });

/** A hand-in as the console and the rider app show it */
export const handInView = (h) => ({
  id: h.id,
  riderId: h.riderId,
  riderName: h.riderName,
  branchId: h.branchId,
  amountLKR: h.amountLKR,
  holdingBeforeLKR: h.holdingBeforeLKR,
  note: h.note || '',
  receivedAt: h.receivedAt,
  receivedBy: h.receivedBy?.name || '',
});

/** For each rider: cash held now, collected and handed in today, and the last hand-in. */
export async function cashByRider(riderIds) {
  const today = startOfTodayColombo();
  const todayOnly = (date, amount) => ({ $sum: { $cond: [{ $gte: [date, today] }, amount, 0] } });
  const [collected, handed] = await Promise.all([
    col('orders')
      .aggregate([
        { $match: cashOrders(riderIds) },
        { $group: { _id: '$riderId', total: { $sum: '$cashCollectedLKR' }, today: todayOnly('$deliveredAt', '$cashCollectedLKR') } },
      ])
      .toArray(),
    col('cash_handins')
      .aggregate([
        { $match: { riderId: { $in: riderIds } } },
        { $sort: { receivedAt: -1 } },
        { $group: { _id: '$riderId', total: { $sum: '$amountLKR' }, today: todayOnly('$receivedAt', '$amountLKR'), last: { $first: '$$ROOT' } } },
      ])
      .toArray(),
  ]);
  const out = {};
  for (const id of riderIds) {
    const c = collected.find((x) => x._id === id);
    const h = handed.find((x) => x._id === id);
    out[id] = {
      holdingLKR: Math.max(0, (c?.total || 0) - (h?.total || 0)),
      collectedTodayLKR: c?.today || 0,
      handedInTodayLKR: h?.today || 0,
      lastHandIn: h ? handInView(h.last) : null,
    };
  }
  return out;
}

/**
 * The deliveries whose cash the rider still holds (oldest first), with what is owed on each.
 * The oldest count as paid first, so these are the latest deliveries adding up to what they hold
 * (only those are read, however long the rider has worked).
 */
export async function unpaidCashOrders(riderId, holdingLKR) {
  const holding = holdingLKR ?? (await cashByRider([riderId]))[riderId].holdingLKR;
  if (holding <= 0) return [];
  const cursor = col('orders')
    .find(cashOrders([riderId]), { projection: { _id: 0, orderReference: 1, customerName: 1, city: 1, deliveredAt: 1, cashCollectedLKR: 1 } })
    .sort({ deliveredAt: -1 });
  const unpaid = [];
  let left = holding;
  for await (const o of cursor) {
    const owed = Math.min(o.cashCollectedLKR, left);
    unpaid.push({ ...o, owedLKR: owed });
    left -= owed;
    if (left <= 0) break;
  }
  await cursor.close();
  return unpaid.reverse();
}

/** Cash still held from deliveries before today, by day (Sri Lanka time), oldest first */
export function earlierDays(unpaid, today = startOfTodayColombo()) {
  const days = new Map();
  for (const o of unpaid.filter((x) => x.deliveredAt < today)) {
    const day = colomboDay(o.deliveredAt);
    const d = days.get(day) || { day, amountLKR: 0, deliveries: 0 };
    d.amountLKR += o.owedLKR;
    d.deliveries += 1;
    days.set(day, d);
  }
  return [...days.values()];
}
