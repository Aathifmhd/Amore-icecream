/*
 * Shared by the rider app (routes/rider.js) and the console's Riders page (routes/riders.js).
 *
 * The delivery flow with riders:
 *   preparing  → the kitchen presses "Ready for rider" (readyAt is set; the status stays "preparing")
 *   ready      → a rider of that parlour presses "Pick up": status "on_the_way", riderId/Name/Phone set
 *   on the way → the rider presses "Delivered" (confirming any cash): status "delivered"
 *              → or "Hand back" with a reason: back to ready, the reason kept as riderNote
 */

// "Today" in Sri Lanka (UTC+5:30), as an ISO time, for the riders' daily counts
export function startOfTodayColombo(nowMs = Date.now()) {
  const offset = 5.5 * 3600 * 1000;
  const day = Math.floor((nowMs + offset) / 86_400_000) * 86_400_000;
  return new Date(day - offset).toISOString();
}

/** "2026-10-22": the day (in Sri Lanka) of an ISO time */
export const colomboDay = (iso) => new Date(Date.parse(iso) + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/** The first moment of this month in Sri Lanka, as an ISO time */
export function startOfMonthColombo(nowMs = Date.now()) {
  const offset = 5.5 * 3600 * 1000;
  const local = new Date(nowMs + offset);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - offset).toISOString();
}

/** A delivery waiting for a rider at this parlour */
export const readyQuery = (branchId) => ({
  branchId,
  orderType: 'delivery',
  status: 'preparing',
  readyAt: { $exists: true, $nin: [null, ''] },
  riderId: { $in: [null, ''] },
});

/** Cash the rider takes at the door (card orders are already paid) */
export const collectsCash = (o) => o.paymentMethod !== 'card';

/** What a rider sees of an order: what to carry, where to go, whom to call, what to collect. */
export const riderOrderView = (o) => ({
  orderReference: o.orderReference,
  createdAt: o.createdAt,
  readyAt: o.readyAt || null,
  status: o.status,
  customerName: o.customerName,
  contactNumber: o.contactNumber,
  deliveryAddress: o.deliveryAddress,
  city: o.city,
  deliveryCoordinates: o.deliveryCoordinates || null,
  specialNote: o.specialNote || '',
  items: (o.items || []).map((i) => ({ name: i.name, format: i.format || null, quantity: i.quantity })),
  grandTotalLKR: o.grandTotalLKR,
  paymentMethod: o.paymentMethod || 'cod',
  cardBrand: o.paymentMethod === 'card' ? o.cardBrand || null : null,
  collectCash: collectsCash(o),
  branchId: o.branchId,
  onTheWayAt: o.onTheWayAt || null,
  deliveredAt: o.deliveredAt || null,
  cashCollectedLKR: o.cashCollectedLKR ?? null,
  // How it was paid in the end (cash, bank transfer, card machine) and who marked it delivered
  paidVia: o.paidVia || null,
  deliveredBy: o.deliveredBy || null,
  // The customer's stars for this delivery (riderRatings.js); their comment is for the parlour only
  riderRating: o.riderRating ?? null,
  riderNote: o.riderNote || null,
});
