import { col } from './db.js';
import { startOfTodayColombo } from './riderOrders.js';

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

/** The deliveries whose cash the rider still holds (oldest first), with what is owed on each. */
export async function unpaidCashOrders(riderId) {
  const [orders, handed] = await Promise.all([
    col('orders')
      .find(cashOrders([riderId]), { projection: { _id: 0, orderReference: 1, customerName: 1, city: 1, deliveredAt: 1, cashCollectedLKR: 1 } })
      .sort({ deliveredAt: 1 })
      .toArray(),
    col('cash_handins').aggregate([{ $match: { riderId } }, { $group: { _id: null, total: { $sum: '$amountLKR' } } }]).toArray(),
  ]);
  let paid = handed[0]?.total || 0;
  const unpaid = [];
  for (const o of orders) {
    const covered = Math.min(paid, o.cashCollectedLKR);
    paid -= covered;
    if (o.cashCollectedLKR > covered) unpaid.push({ ...o, owedLKR: o.cashCollectedLKR - covered });
  }
  return unpaid;
}
