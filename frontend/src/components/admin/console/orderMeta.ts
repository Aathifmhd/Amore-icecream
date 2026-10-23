/**
 * Plain-language order status, colours and "next step" for the operations console.
 */
import { OrderRecord, PaidVia } from '../../../types';
import type { Tone } from './ui';

export type Stage = 'new' | 'preparing' | 'ready' | 'done' | 'cancelled';

/** A delivery packed and waiting for a rider to pick it up (rider app) */
export const waitingForRider = (o: OrderRecord) => o.orderType !== 'pickup' && o.status === 'preparing' && Boolean(o.readyAt);

/** Where an order sits on the board. Accepted-but-not-started orders wait in "Preparing". */
export function stageOf(o: OrderRecord): Stage {
  switch (o.status) {
    case 'pending_confirmation':
      return 'new';
    case 'paid':
    case 'confirmed':
      return 'preparing';
    case 'preparing':
      return waitingForRider(o) ? 'ready' : 'preparing';
    case 'on_the_way':
      return 'ready';
    case 'delivered':
      return 'done';
    case 'cancelled':
    default:
      return 'cancelled';
  }
}

export const isPickup = (o: OrderRecord) => o.orderType === 'pickup';

export function statusLabel(o: OrderRecord): { label: string; tone: Tone } {
  switch (o.status) {
    case 'pending_confirmation':
      return { label: 'New – needs accepting', tone: 'amber' };
    case 'paid':
    case 'confirmed':
      return { label: 'Accepted – not started', tone: 'blue' };
    case 'preparing':
      return waitingForRider(o) ? { label: 'Ready – waiting for a rider', tone: 'amber' } : { label: 'Preparing', tone: 'violet' };
    case 'on_the_way':
      if (isPickup(o)) return { label: 'Ready for pickup', tone: 'blue' };
      return { label: o.riderName ? `Out with ${o.riderName}` : 'Out for delivery', tone: 'blue' };
    case 'delivered':
      return isPickup(o) ? { label: 'Collected', tone: 'green' } : { label: 'Delivered', tone: 'green' };
    case 'cancelled':
      return { label: o.cancelledBy === 'customer' ? 'Cancelled by customer' : 'Cancelled', tone: 'grey' };
    default:
      return { label: o.status, tone: 'grey' };
  }
}

export type NextStep = 'accept' | 'start' | 'ready' | 'send' | 'finish';

/**
 * The single main action for an order, or null when there is nothing left to do.
 * `quiet`: shown as a plain button (a delivery waiting for the riders' app).
 */
export function nextStep(o: OrderRecord): { step: NextStep; label: string; quiet?: boolean } | null {
  switch (o.status) {
    case 'pending_confirmation':
      return { step: 'accept', label: 'Accept order' };
    case 'paid':
    case 'confirmed':
      return { step: 'start', label: 'Start preparing' };
    case 'preparing':
      if (isPickup(o)) return { step: 'send', label: 'Ready for pickup' };
      // Deliveries go to the riders' app; "Out for delivery" is for a rider without the app
      return o.readyAt ? { step: 'send', label: 'Out for delivery (no app)', quiet: true } : { step: 'ready', label: 'Ready for rider' };
    case 'on_the_way':
      return isPickup(o) ? { step: 'finish', label: 'Mark collected' } : { step: 'finish', label: 'Mark delivered' };
    default:
      return null;
  }
}

/** "Visa •••• 4242" for a card payment */
export const cardText = (o: Pick<OrderRecord, 'cardBrand' | 'cardLast4'>) =>
  [o.cardBrand, o.cardLast4 && `•••• ${o.cardLast4}`].filter(Boolean).join(' ');

const PAID_VIA: Record<PaidVia, string> = { cash: 'Paid in cash', bank_transfer: 'Paid by bank transfer', card_machine: 'Paid by card machine' };

/** How the order is (or was) paid, in a few words */
export function paymentLabel(o: OrderRecord): string {
  if (o.status === 'delivered' && o.paidVia && o.paymentMethod !== 'card') {
    if (o.paidVia === 'cash' && o.riderName && o.cashCollectedLKR) return `Cash · collected by ${o.riderName.split(' ')[0]}`;
    return PAID_VIA[o.paidVia];
  }
  switch (o.paymentMethod) {
    case 'card':
      return 'Paid by card';
    case 'pay_at_parlour':
      return 'Pay at counter';
    case 'cash':
      return o.orderType === 'pickup' ? 'Cash' : 'Cash on delivery';
    case 'cod':
      return 'Cash on delivery';
    default:
      return o.orderType === 'pickup' ? 'Pay at counter' : 'Cash on delivery';
  }
}

const FORMAT: Record<string, string> = {
  'waffle-cone': 'waffle cone',
  'biscuit-cup': 'biscuit cup',
  'double-cone': 'double cone',
  'double-biscuit-cup': 'double biscuit cup',
};
export const formatLabel = (f?: string) => (f ? FORMAT[f] || f.replace(/-/g, ' ') : '');

/** "AMO-7KQ4XP" → "#7KQ4XP" for quick reading in the kitchen. */
export const shortRef = (ref: string) => '#' + ref.replace(/^(AMO|RET)-(M)?/, (_, p, m) => (p === 'RET' ? 'R' : '') + (m || ''));

export function timeAgo(iso?: string, now = Date.now()): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ${mins % 60} min ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const clockTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';

export const isToday = (iso?: string) => {
  if (!iso) return false;
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

export const itemCount = (o: OrderRecord) => o.items.reduce((s, i) => s + i.quantity, 0);

/** Customers get this long after ordering to change or cancel before the parlour accepts. */
export const GRACE_SECONDS = 120;
/** If a customer starts editing and walks away, staff may accept after this long. */
export const STUCK_EDIT_SECONDS = 180;

export type Grace =
  | { state: 'open' }
  | { state: 'counting'; remaining: number }
  | { state: 'editing'; pausedFor: number; canOverride: boolean };

/** Whether a new order can be accepted yet (customer's 2-minute change window). */
export function graceOf(o: OrderRecord, now: number): Grace {
  if (o.status !== 'pending_confirmation') return { state: 'open' };
  if (o.isGracePeriodPaused) {
    const pausedFor = o.gracePeriodPausedAt ? Math.max(0, (now - new Date(o.gracePeriodPausedAt).getTime()) / 1000) : 0;
    return { state: 'editing', pausedFor, canOverride: pausedFor >= STUCK_EDIT_SECONDS };
  }
  const elapsed = (now - new Date(o.createdAt).getTime()) / 1000;
  const remaining = Math.ceil(GRACE_SECONDS - elapsed);
  return remaining > 0 ? { state: 'counting', remaining } : { state: 'open' };
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

/**
 * When an order counts as a sale (used by Reports and the Dashboard):
 * a card delivery payment counts once the parlour accepts it (it is captured then);
 * cash and counter payments count once the order is delivered / collected.
 */
export function saleTime(o: OrderRecord): string | null {
  if (o.orderReference.startsWith('RET-') || o.items.some((i) => i.itemId === 'returned-item-manual')) return null;
  const card = o.paymentMethod === 'card' && o.orderType !== 'pickup';
  if (card) {
    const captured = ['confirmed', 'paid', 'preparing', 'on_the_way', 'delivered'].includes(o.status) || (o.status === 'cancelled' && !!o.confirmedAt);
    return captured ? o.confirmedAt || o.createdAt : null;
  }
  return o.status === 'delivered' ? o.deliveredAt || o.createdAt : null;
}
