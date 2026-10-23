import { col } from './db.js';
import { startOfMonthColombo } from './riderOrders.js';

/*
 * Customers rate the rider (1–5 stars, with an optional comment) once their delivery arrives.
 * The stars live on the order (riderRating, riderFeedback, ratedAt); see orderRules.js.
 */

const rated = (riderIds) => ({ riderId: { $in: riderIds }, riderRating: { $gte: 1 } });
const round1 = (n) => Math.round(n * 10) / 10;

/** Average stars and how many ratings, for each rider */
export async function ratingSummary(riderIds) {
  const rows = await col('orders')
    .aggregate([{ $match: rated(riderIds) }, { $group: { _id: '$riderId', average: { $avg: '$riderRating' }, count: { $sum: 1 } } }])
    .toArray();
  const out = {};
  for (const id of riderIds) {
    const r = rows.find((x) => x._id === id);
    out[id] = { average: r ? round1(r.average) : null, count: r?.count || 0 };
  }
  return out;
}

/**
 * One rider's ratings: the average, how many of each star, and the latest ratings (stars only —
 * comments are for the parlour); with how many deliveries they have made in all and this month.
 */
export async function riderRatings(riderId, limit = 30) {
  const delivered = { riderId, status: 'delivered' };
  const [summary, breakdown, recent, total, thisMonth] = await Promise.all([
    ratingSummary([riderId]),
    col('orders').aggregate([{ $match: rated([riderId]) }, { $group: { _id: '$riderRating', count: { $sum: 1 } } }]).toArray(),
    col('orders')
      .find(rated([riderId]), { projection: { _id: 0, orderReference: 1, customerName: 1, riderRating: 1, ratedAt: 1 } })
      .sort({ ratedAt: -1 })
      .limit(limit)
      .toArray(),
    col('orders').countDocuments(delivered),
    col('orders').countDocuments({ ...delivered, deliveredAt: { $gte: startOfMonthColombo() } }),
  ]);
  return {
    ...summary[riderId],
    deliveries: { total, thisMonth },
    breakdown: Object.fromEntries([5, 4, 3, 2, 1].map((s) => [s, breakdown.find((b) => b._id === s)?.count || 0])),
    // Riders see the customer's first name only
    recent: recent.map((o) => ({
      orderReference: o.orderReference,
      customerFirstName: String(o.customerName || '').trim().split(/\s+/)[0] || 'A customer',
      rating: o.riderRating,
      ratedAt: o.ratedAt,
    })),
  };
}
