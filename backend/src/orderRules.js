import { HttpError } from './auth.js';

/*
 * What may be written to an order, and by whom.
 * (These replace the old Firestore security rules.)
 */

// Every field an order may hold (mirrors OrderRecord in frontend/src/types.ts)
export const ORDER_FIELDS = [
  'orderReference', 'createdAt', 'customerName', 'contactNumber', 'orderType',
  'deliveryAddress', 'city', 'deliveryCoordinates', 'specialNote', 'whatsappNumber',
  'emailAddress', 'branchId', 'branchName', 'branchCity', 'items', 'subtotalLKR',
  'deliveryFeeLKR', 'grandTotalLKR', 'currency', 'status', 'paymentMethod', 'paidAt',
  'cardLast4', 'cardBrand', 'userId', 'cancelledAt', 'updatedAt', 'cancelledBy',
  'cancellationReason', 'inconvenienceEmailContent', 'confirmedAt', 'preparingAt',
  'onTheWayAt', 'deliveredAt', 'isGracePeriodPaused', 'gracePeriodRemainingSeconds',
  'gracePeriodPausedAt', 'refundStatus', 'refundedAt', 'refundAmountLKR',
  'customerDeletedHistory',
];

const STATUSES = ['pending_confirmation', 'paid', 'confirmed', 'cancelled', 'preparing', 'on_the_way', 'delivered'];
const BRANCHES = ['akurana', 'colombo', 'arugambay'];
// No online card gateway is connected yet (see ONLINE_CARD_PAYMENTS_ENABLED in the frontend)
const CUSTOMER_PAYMENTS = ['cod', 'cash', 'pay_at_parlour'];

// Fields a customer may send when placing an order
const NEW_ORDER_FIELDS = [
  'orderReference', 'createdAt', 'customerName', 'contactNumber', 'orderType',
  'deliveryAddress', 'city', 'deliveryCoordinates', 'specialNote', 'whatsappNumber',
  'emailAddress', 'branchId', 'branchName', 'branchCity', 'items', 'subtotalLKR',
  'deliveryFeeLKR', 'grandTotalLKR', 'currency', 'status', 'paymentMethod', 'userId',
];

// While an order awaits confirmation, its owner may edit delivery details, pause/resume
// the 2-minute grace timer, change how they pay, or cancel it.
const CUSTOMER_EDIT_FIELDS = [
  'status', 'cancelledAt', 'cancelledBy', 'cancellationReason', 'updatedAt',
  'deliveryAddress', 'city', 'contactNumber', 'deliveryCoordinates', 'specialNote',
  'isGracePeriodPaused', 'gracePeriodRemainingSeconds', 'gracePeriodPausedAt',
  'createdAt', 'paymentMethod', 'customerDeletedHistory',
];
// After that, they may only hide it from their history
const HISTORY_HIDE_FIELDS = ['customerDeletedHistory', 'updatedAt'];

const bad = (msg) => new HttpError(400, msg);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max) => typeof v === 'string' && v.length <= max;
const num = (v, min = 0, max = 10_000_000) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isDate = (v) => typeof v === 'string' && v.length <= 40 && (v === '' || !Number.isNaN(Date.parse(v)));
const isCoords = (v) => isObj(v) && num(v.lat, -90, 90) && num(v.lng, -180, 180);

// Type of every field; anything else in a request is dropped
const FIELD_CHECKS = {
  orderReference: (v) => str(v, 40) && /^[A-Za-z0-9-]{3,40}$/.test(v),
  createdAt: isDate,
  customerName: (v) => str(v, 100),
  contactNumber: (v) => str(v, 30),
  orderType: (v) => v === 'delivery' || v === 'pickup',
  deliveryAddress: (v) => str(v, 300),
  city: (v) => str(v, 100),
  deliveryCoordinates: isCoords,
  specialNote: (v) => str(v, 500),
  whatsappNumber: (v) => str(v, 30),
  emailAddress: (v) => str(v, 120),
  branchId: (v) => BRANCHES.includes(v),
  branchName: (v) => str(v, 100),
  branchCity: (v) => str(v, 100),
  items: (v) => Array.isArray(v) && v.length <= 50 && v.every(isItem),
  subtotalLKR: (v) => num(v),
  deliveryFeeLKR: (v) => num(v),
  grandTotalLKR: (v) => num(v),
  currency: (v) => v === 'LKR' || v === 'USD',
  status: (v) => STATUSES.includes(v),
  paymentMethod: (v) => ['card', 'cash', 'cod', 'pay_at_parlour'].includes(v),
  paidAt: isDate,
  cardLast4: (v) => str(v, 4),
  cardBrand: (v) => str(v, 30),
  userId: (v) => str(v, 128),
  cancelledAt: isDate,
  updatedAt: isDate,
  cancelledBy: (v) => v === 'customer' || v === 'admin',
  cancellationReason: (v) => str(v, 500),
  inconvenienceEmailContent: (v) => str(v, 5000),
  confirmedAt: isDate,
  preparingAt: isDate,
  onTheWayAt: isDate,
  deliveredAt: isDate,
  isGracePeriodPaused: (v) => typeof v === 'boolean',
  gracePeriodRemainingSeconds: (v) => num(v, 0, 3600),
  gracePeriodPausedAt: isDate,
  refundStatus: (v) => v === 'pending' || v === 'completed',
  refundedAt: isDate,
  refundAmountLKR: (v) => num(v),
  customerDeletedHistory: (v) => typeof v === 'boolean',
};

function isItem(i) {
  return (
    isObj(i) &&
    str(i.itemId, 80) &&
    str(i.name, 150) &&
    (i.category === undefined || str(i.category, 40)) &&
    (i.format === undefined || str(i.format, 40)) &&
    num(i.priceLKR, 0, 1_000_000) &&
    Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= 99 &&
    (i.notes === undefined || str(i.notes, 500)) &&
    (i.image === undefined || typeof i.image === 'string')
  );
}

// Only the known item fields are kept. Photo links are only for display, so a very long one
// (an old inline photo) is dropped instead of refusing the order.
const cleanItem = (i) => ({
  itemId: i.itemId,
  name: i.name,
  ...(i.category !== undefined && { category: i.category }),
  ...(i.format !== undefined && { format: i.format }),
  priceLKR: i.priceLKR,
  quantity: i.quantity,
  ...(i.notes !== undefined && { notes: i.notes }),
  ...(typeof i.image === 'string' && i.image.length <= 2000 && { image: i.image }),
});

/**
 * Keep only known fields with the right types. `null` means "remove this field" (only in updates).
 * Throws 400 naming the first field with a wrong value.
 */
function pick(body, allowed, { forUpdate = false } = {}) {
  if (!isObj(body)) throw bad('Expected a JSON object');
  const out = {};
  const unset = [];
  for (const key of allowed) {
    if (!(key in body) || body[key] === undefined) continue;
    const value = body[key];
    if (value === null) {
      if (forUpdate) unset.push(key);
      continue;
    }
    if (!FIELD_CHECKS[key](value)) throw bad(`Invalid value for ${key}`);
    out[key] = key === 'items' ? value.map(cleanItem) : value;
  }
  return { set: out, unset };
}

const close = (a, b) => Math.abs(a - b) < 0.5;

// Where each parlour is, and how far it delivers (mirrors frontend/src/utils/branchLocation.ts)
const BRANCH_COORDS = {
  akurana: { lat: 7.3639, lng: 80.6175 },
  colombo: { lat: 6.909, lng: 79.8478 },
  arugambay: { lat: 6.84, lng: 81.836 },
};
export const DELIVERY_RADIUS_KM = 6;

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** A customer's delivery must have a map pin within the parlour's delivery range. */
function checkDeliveryRange(order) {
  if (order.orderType !== 'delivery') return;
  if (!order.deliveryCoordinates) throw bad('Drop a pin on the map so we can check we deliver to you.');
  // A few metres of slack for rounding between the phone and here
  if (distanceKm(order.deliveryCoordinates, BRANCH_COORDS[order.branchId]) > DELIVERY_RADIUS_KM + 0.05) {
    throw bad(`We can't deliver to this location: we deliver within ${DELIVERY_RADIUS_KM} km of the parlour. You can choose parlour pickup instead.`);
  }
}

/** A customer placing an order (they must be signed in). */
export function newCustomerOrder(body, customer) {
  const { set: d } = pick(body, NEW_ORDER_FIELDS);
  if (!/^AMO-[A-Z0-9]{4,10}$/.test(d.orderReference || '')) throw bad('Invalid order reference');
  if (d.status !== 'pending_confirmation') throw bad('A new order must be awaiting confirmation');
  if (!d.customerName?.trim()) throw bad('Please give your name');
  if (!d.contactNumber?.trim()) throw bad('Please give a contact number');
  for (const key of ['orderType', 'branchId', 'items', 'subtotalLKR', 'deliveryFeeLKR', 'grandTotalLKR', 'currency']) {
    if (d[key] === undefined) throw bad(`Missing ${key}`);
  }
  if (d.items.length === 0) throw bad('The order has no items');
  if (d.paymentMethod !== undefined && !CUSTOMER_PAYMENTS.includes(d.paymentMethod)) {
    throw bad('Card payments are not available yet');
  }
  const itemsTotal = d.items.reduce((sum, i) => sum + i.priceLKR * i.quantity, 0);
  if (!close(itemsTotal, d.subtotalLKR) || !close(d.subtotalLKR + d.deliveryFeeLKR, d.grandTotalLKR)) {
    throw bad('The order total does not add up. Please refresh the page and try again.');
  }
  if (d.deliveryFeeLKR > 5000) throw bad('Invalid delivery fee');
  checkDeliveryRange(d);

  // Trust the sign-in for who placed it, and our clock if theirs is far off
  d.userId = customer.uid;
  const created = Date.parse(d.createdAt || '');
  if (!created || Math.abs(created - Date.now()) > 24 * 3600 * 1000) d.createdAt = new Date().toISOString();
  return d;
}

/** An admin adding an order or refund record by hand. */
export function newAdminOrder(body) {
  const { set: d } = pick(body, ORDER_FIELDS);
  for (const key of ['orderReference', 'customerName', 'branchId', 'status', 'items']) {
    if (d[key] === undefined) throw bad(`Missing ${key}`);
  }
  d.createdAt ||= new Date().toISOString();
  return d;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Turn a PATCH body into a Mongo update for this caller, or throw 400/403. */
export function orderUpdate(body, existing, { admin, customer }) {
  const editable = ORDER_FIELDS.filter((f) => f !== 'orderReference' && f !== 'userId');
  const { set, unset } = pick(body, editable, { forUpdate: true });

  if (!admin) {
    if (!customer || existing.userId !== customer.uid) throw new HttpError(403, 'This is not your order');
    const changed = [
      ...Object.keys(set).filter((k) => !same(set[k], existing[k])),
      ...unset.filter((k) => k in existing),
    ];
    const next = { ...existing, ...set };
    for (const k of unset) delete next[k];

    if (changed.includes('paymentMethod') && !CUSTOMER_PAYMENTS.includes(next.paymentMethod)) {
      throw bad('Card payments are not available yet');
    }
    // A moved pin must still be within the parlour's delivery range
    if (changed.includes('deliveryCoordinates')) checkDeliveryRange(next);
    const historyHide = changed.every((k) => HISTORY_HIDE_FIELDS.includes(k));
    const pendingEdit =
      existing.status === 'pending_confirmation' &&
      changed.every((k) => CUSTOMER_EDIT_FIELDS.includes(k)) &&
      (next.status === 'pending_confirmation' || (next.status === 'cancelled' && next.cancelledBy === 'customer'));
    if (!historyHide && !pendingEdit) {
      throw new HttpError(403, 'This order can no longer be changed. Please call the parlour.');
    }
  }

  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (unset.length) update.$unset = Object.fromEntries(unset.map((k) => [k, '']));
  return update;
}

/** A refund record (manual return bill, or a confirmed card order cancelled later) is never deleted. */
export function isRefundRecord(order) {
  if (order.status !== 'cancelled') return false;
  if (order.orderReference.startsWith('RET-') || order.items?.some((i) => i.itemId === 'returned-item-manual')) return true;
  return order.paymentMethod === 'card' && order.orderType !== 'pickup' && Boolean(order.confirmedAt) && Boolean(order.refundStatus);
}

/** Who may delete this order. Mirrors the console's rule: only unconfirmed or cancelled, never refunds. */
export function checkDelete(order, { admin, customer }) {
  if (admin) {
    if (isRefundRecord(order)) throw new HttpError(403, 'Refund records are kept for the accounts and cannot be deleted');
    if (order.status !== 'pending_confirmation' && order.status !== 'cancelled') {
      throw new HttpError(403, 'Only unconfirmed or cancelled orders can be deleted');
    }
    return;
  }
  if (!customer || order.userId !== customer.uid) throw new HttpError(403, 'This is not your order');
  if (order.status !== 'cancelled' || 'refundStatus' in order) {
    throw new HttpError(403, 'Only your cancelled orders can be removed');
  }
}
