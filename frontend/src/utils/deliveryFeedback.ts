/**
 * Customers rate their delivery (and the rider) with 1–5 stars once it arrives. The shop asks
 * right away (DeliveryFeedbackSheet); "Not now" is remembered on this device, and the order can
 * still be rated from Your Orders. The backend accepts one rating per delivery (orderRules.js).
 */
import type { OrderRecord } from '../types';
import { updateOrder } from './orderStorage';

const DISMISSED_KEY = 'amore_feedback_dismissed_v1';
// Matches the backend: a delivery can be rated for 14 days; the shop only asks for 3
const ASK_FOR_MS = 3 * 86_400_000;

export const STAR_WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent!'];

function dismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

export function dismissFeedback(ref: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed().filter((r) => r !== ref), ref].slice(-50)));
  } catch {
    /* storage blocked */
  }
}

/** A delivered order that can still be rated */
export const canRate = (o: OrderRecord, now = Date.now()) =>
  o.status === 'delivered' && o.orderType === 'delivery' && !o.riderRating && now - Date.parse(o.deliveredAt || o.updatedAt || '') < 14 * 86_400_000;

/** The latest delivery to ask about now (recently delivered, not rated, not put off), or null */
export function deliveryToRate(orders: OrderRecord[], now = Date.now()): OrderRecord | null {
  const skip = dismissed();
  return (
    orders
      .filter((o) => canRate(o, now) && now - Date.parse(o.deliveredAt || '') < ASK_FOR_MS && !skip.includes(o.orderReference))
      .sort((a, b) => (b.deliveredAt || '').localeCompare(a.deliveredAt || ''))[0] ?? null
  );
}

/** Save the customer's stars (sent to the server like any other change to their order) */
export function rateDelivery(ref: string, rating: number, comment: string) {
  const now = new Date().toISOString();
  return updateOrder(ref, { riderRating: rating, ...(comment.trim() && { riderFeedback: comment.trim() }), ratedAt: now, updatedAt: now });
}
