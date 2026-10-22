import { OrderRecord, BranchId } from '../types';
import { AMORE_BRANCHES, resolveBundledImage } from '../data/iceCreamData';
import {
  saveOrderToFirestore,
  updateOrderInFirestore,
  deleteOrderFromFirestore,
  getAllOrdersFromFirestore,
  getUserOrdersFromFirestore,
  auth,
} from '../firebase';

const STORAGE_KEY = 'amore_orders_v1';
const SESSION_ORDERS_KEY = 'amore_session_orders_v1';
export const ORDERS_UPDATED_EVENT = 'amore_orders_updated';

/**
 * Creates an order reference like AMO-7KQ4XP. Uses crypto randomness and an alphabet
 * without look-alike characters (0/O, 1/I/L), giving ~887 million combinations so
 * references don't collide and can't be guessed.
 */
export function generateOrderReference(prefix: string): string {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return `${prefix}-${code}`;
}

/**
 * Orders keep a photo URL per item. Ones saved against an older build point at files
 * that no longer exist, so map them to the current build's copy (see resolveBundledImage).
 */
export function withCurrentItemImages(order: OrderRecord): OrderRecord {
  if (!order?.items?.some((i) => resolveBundledImage(i.image) !== i.image)) return order;
  return {
    ...order,
    items: order.items.map((i) => ({ ...i, image: resolveBundledImage(i.image) })),
  };
}

export function notifyOrdersUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
  }
}

/**
 * Retrieves the order references placed during the current browser session
 */
export function getSessionOrderRefs(): string[] {
  try {
    const raw = sessionStorage.getItem(SESSION_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Records an order reference to the current browser session
 */
export function recordSessionOrderRef(ref: string): void {
  try {
    const refs = getSessionOrderRefs();
    if (!refs.includes(ref)) {
      refs.push(ref);
      sessionStorage.setItem(SESSION_ORDERS_KEY, JSON.stringify(refs));
    }
  } catch (err) {
    console.warn('Could not record session order ref:', err);
  }
}

export const CUSTOMER_DELETED_HISTORY_KEY = 'amore_customer_deleted_history_v1';

export function getCustomerDeletedHistoryRefs(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOMER_DELETED_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function removeSessionOrderRef(ref: string): void {
  try {
    const refs = getSessionOrderRefs();
    const updated = refs.filter((r) => r !== ref);
    sessionStorage.setItem(SESSION_ORDERS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

export function clearSessionOrderRefs(): void {
  try {
    sessionStorage.removeItem(SESSION_ORDERS_KEY);
  } catch {
    // Ignore
  }
}

export function getAllOrders(): Record<string, OrderRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: Record<string, OrderRecord> = JSON.parse(raw);

    // Purge legacy test order AMO-3899 from local storage
    if (parsed['AMO-3899']) {
      delete parsed['AMO-3899'];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }

    // Ensure any card order cancelled before admin confirmation does NOT have refundStatus
    let hadCleanup = false;
    for (const key of Object.keys(parsed)) {
      const o = parsed[key];
      if (
        o.status === 'cancelled' &&
        o.paymentMethod === 'card' &&
        !o.confirmedAt &&
        !o.orderReference.startsWith('RET-') &&
        o.refundStatus !== undefined
      ) {
        delete o.refundStatus;
        delete o.refundAmountLKR;
        hadCleanup = true;
      }
    }
    for (const key of Object.keys(parsed)) {
      const fixed = withCurrentItemImages(parsed[key]);
      if (fixed !== parsed[key]) {
        parsed[key] = fixed;
        hadCleanup = true;
      }
    }

    if (hadCleanup) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }

    return parsed;
  } catch (err) {
    console.error('Failed to load orders from localStorage:', err);
    return {};
  }
}

export function saveOrder(order: OrderRecord): void {
  try {
    // Record in current session so this user can always track their order
    recordSessionOrderRef(order.orderReference);

    const all = getAllOrders();
    all[order.orderReference] = order;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    notifyOrdersUpdated();
  } catch (err) {
    console.error('Failed to save order to localStorage:', err);
  }

  // Asynchronously persist to Cloud Firestore
  try {
    const currentUid = auth.currentUser?.uid || order.userId;
    saveOrderToFirestore(order, currentUid);
  } catch (e) {
    console.warn('Firestore background save error:', e);
  }
}

export function updateOrder(orderReference: string, updates: Partial<OrderRecord>): OrderRecord | null {
  let updated: OrderRecord | null = null;
  try {
    const all = getAllOrders();
    const existing = all[orderReference];
    if (existing) {
      updated = { ...existing, ...updates };
      all[orderReference] = updated;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      notifyOrdersUpdated();
    }
  } catch (err) {
    console.error('Failed to update order:', err);
  }

  // Update in Cloud Firestore
  try {
    updateOrderInFirestore(orderReference, updates);
  } catch (e) {
    console.warn('Firestore background update error:', e);
  }

  return updated;
}

export function getOrder(orderReference: string): OrderRecord | null {
  try {
    const all = getAllOrders();
    if (all[orderReference]) {
      return all[orderReference];
    }
  } catch (err) {
    console.error('Failed to get order:', err);
  }
  return null;
}

/**
 * Returns a list of orders for the current user.
 * - Authenticated users see only their own orders (or orders created in this browser session).
 * - Guest users see ONLY orders created in this browser session.
 * - AMO-3899 or other users' orders are NEVER returned.
 */
export function getUserOrdersList(userId?: string | null): OrderRecord[] {
  try {
    const all = getAllOrders();
    const list = Object.values(all);
    const sessionRefs = getSessionOrderRefs();
    const deletedHistoryRefs = getCustomerDeletedHistoryRefs();

    let filtered: OrderRecord[] = [];
    if (userId && userId.trim()) {
      // Authenticated user: must match user ID or be created in this browser session
      filtered = list.filter(
        (o) =>
          o.orderReference !== 'AMO-3899' &&
          !o.customerDeletedHistory &&
          !deletedHistoryRefs.includes(o.orderReference) &&
          (o.userId === userId || sessionRefs.includes(o.orderReference))
      );
    } else {
      // Unauthenticated visitor: ONLY orders placed in this specific browser session
      filtered = list.filter(
        (o) =>
          o.orderReference !== 'AMO-3899' &&
          !o.customerDeletedHistory &&
          !deletedHistoryRefs.includes(o.orderReference) &&
          sessionRefs.includes(o.orderReference)
      );
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('Failed to get user orders list:', err);
    return [];
  }
}

/**
 * Cancels an order within its grace period or active state.
 */
export function cancelOrder(
  orderReference: string,
  cancelledBy: 'customer' | 'admin' = 'customer',
  reason?: string
): OrderRecord | null {
  return updateOrder(orderReference, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancelledBy,
    cancellationReason: reason,
  });
}

/**
 * Updates delivery details for an ongoing order during grace period.
 */
export function updateOrderDelivery(
  orderReference: string,
  details: {
    deliveryAddress?: string;
    city?: string;
    contactNumber?: string;
    specialNote?: string;
    deliveryCoordinates?: { lat: number; lng: number };
  }
): OrderRecord | null {
  return updateOrder(orderReference, {
    ...details,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Pauses the 2-minute countdown for an ongoing order when customer clicks "Edit Address"
 */
export function pauseOrderGracePeriod(
  orderReference: string,
  remainingSeconds: number
): OrderRecord | null {
  return updateOrder(orderReference, {
    isGracePeriodPaused: true,
    gracePeriodRemainingSeconds: Math.max(0, remainingSeconds),
    gracePeriodPausedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Resumes the countdown when customer clicks "Save Changes" (or discards/finishes editing)
 */
export function resumeOrderGracePeriod(
  orderReference: string,
  remainingSeconds: number,
  deliveryDetails?: {
    deliveryAddress?: string;
    city?: string;
    contactNumber?: string;
    specialNote?: string;
    deliveryCoordinates?: { lat: number; lng: number };
  }
): OrderRecord | null {
  // To make the countdown resume naturally from remainingSeconds,
  // we adjust createdAt so elapsed time = (120 - remainingSeconds) seconds.
  const safeRemaining = Math.max(0, remainingSeconds);
  const newCreatedAt = new Date(Date.now() - (120 - safeRemaining) * 1000).toISOString();
  return updateOrder(orderReference, {
    ...(deliveryDetails || {}),
    createdAt: newCreatedAt,
    isGracePeriodPaused: false,
    gracePeriodRemainingSeconds: 0,
    gracePeriodPausedAt: '',
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Merges a list of orders (e.g. from Cloud Firestore) into local storage
 */
export function mergeOrdersIntoStorage(incomingOrders: OrderRecord[]): void {
  try {
    const all = getAllOrders();
    let hasChanges = false;

    for (const order of incomingOrders) {
      if (!order || !order.orderReference || order.orderReference === 'AMO-3899') continue;
      const existing = all[order.orderReference];
      if (
        !existing ||
        existing.status !== order.status ||
        new Date(order.updatedAt || order.createdAt).getTime() >=
          new Date(existing.updatedAt || existing.createdAt).getTime()
      ) {
        const merged = { ...existing, ...order };
        // Strip refundStatus if card order was cancelled before confirmation
        if (
          merged.status === 'cancelled' &&
          merged.paymentMethod === 'card' &&
          !merged.confirmedAt &&
          !merged.orderReference.startsWith('RET-')
        ) {
          delete merged.refundStatus;
          delete merged.refundAmountLKR;
        }
        all[order.orderReference] = merged;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      notifyOrdersUpdated();
    }
  } catch (err) {
    console.warn('Failed to merge orders into storage:', err);
  }
}

/**
 * Admin: Asynchronously sync all orders from Cloud Firestore into local storage
 */
export async function syncOrdersFromFirestore(): Promise<OrderRecord[]> {
  try {
    const cloudOrders = await getAllOrdersFromFirestore();
    if (cloudOrders && cloudOrders.length > 0) {
      mergeOrdersIntoStorage(cloudOrders);
    }
    return getAllOrdersAdmin();
  } catch (err) {
    console.warn('Failed to sync orders from Firestore:', err);
    return getAllOrdersAdmin();
  }
}

/**
 * Customer: Sync orders for a specific user from Cloud Firestore
 */
export async function syncUserOrdersFromFirestore(userId: string): Promise<OrderRecord[]> {
  try {
    const cloudOrders = await getUserOrdersFromFirestore(userId);
    if (cloudOrders && cloudOrders.length > 0) {
      mergeOrdersIntoStorage(cloudOrders);
    }
    return getUserOrdersList(userId);
  } catch (err) {
    console.warn('Failed to sync user orders from Firestore:', err);
    return getUserOrdersList(userId);
  }
}

/**
 * Admin: Get all orders across all users sorted newest first
 */
export function getAllOrdersAdmin(): OrderRecord[] {
  try {
    const all = getAllOrders();
    const list = Object.values(all).filter((o) => o.orderReference !== 'AMO-3899');
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('Failed to get all orders for admin:', err);
    return [];
  }
}

/**
 * Strict Policy Helper:
 * Checks if an order is an official Returned Bill (payment was already confirmed and captured
 * before cancellation, or is a manual counter return bill).
 * An order cancelled by admin/customer BEFORE confirming the order (no payment captured)
 * is NEVER a returned bill!
 */
export function isCapturedReturnedBill(order: OrderRecord): boolean {
  if (order.status !== 'cancelled') return false;

  // Manual return bill created by admin
  if (order.orderReference.startsWith('RET-') || order.items?.some((i) => i.itemId === 'returned-item-manual')) {
    return true;
  }

  // Card delivery order that was confirmed by admin/owner before being cancelled
  return (
    order.paymentMethod === 'card' &&
    order.orderType !== 'pickup' &&
    Boolean(order.confirmedAt) &&
    Boolean(order.refundStatus)
  );
}

/**
 * Admin: Permanently delete an order from storage & firestore
 * CRUD Policy: Confirmed, preparing, on the way, or delivered orders cannot be deleted.
 */
export function deleteOrder(orderReference: string): boolean {
  try {
    const all = getAllOrders();
    const existing = all[orderReference];
    if (existing) {
      // Accounting & Audit Policy: Returned bills & credit notes can NEVER be deleted!
      if (isCapturedReturnedBill(existing)) {
        console.warn(`Accounting Policy: Return bill ${orderReference} is a financial credit note and cannot be deleted.`);
        return false;
      }

      // CRUD Policy: Only unconfirmed (pending_confirmation) or non-refund cancelled orders can be deleted
      if (existing.status !== 'pending_confirmation' && existing.status !== 'cancelled') {
        console.warn(`CRUD Policy Restriction: Order ${orderReference} is ${existing.status} and cannot be deleted.`);
        return false;
      }
      delete all[orderReference];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      notifyOrdersUpdated();
      deleteOrderFromFirestore(orderReference).catch(() => {});
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to delete order:', err);
    return false;
  }
}

/**
 * Customer: Delete a specific order from customer's history
 */
export function deleteCustomerHistoryOrder(orderReference: string): boolean {
  try {
    // 1. Add to local deleted history refs
    const deletedRefs = getCustomerDeletedHistoryRefs();
    if (!deletedRefs.includes(orderReference)) {
      deletedRefs.push(orderReference);
      localStorage.setItem(CUSTOMER_DELETED_HISTORY_KEY, JSON.stringify(deletedRefs));
    }

    // 2. Remove from session order refs
    removeSessionOrderRef(orderReference);

    // 3. Mark customerDeletedHistory on order record in localStorage and Firestore
    const existing = getOrder(orderReference);
    if (existing) {
      updateOrder(orderReference, { customerDeletedHistory: true });
      // If the order was cancelled and not a captured return bill, delete it permanently
      if (existing.status === 'cancelled' && !isCapturedReturnedBill(existing)) {
        deleteOrder(orderReference);
      }
    }

    notifyOrdersUpdated();
    return true;
  } catch (err) {
    console.error('Failed to delete customer history order:', err);
    return false;
  }
}

/**
 * Customer: Clear all history orders
 */
export function clearCustomerOrderHistory(userId?: string | null): boolean {
  try {
    const userOrders = getUserOrdersList(userId);
    const historyList = userOrders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');

    const deletedRefs = getCustomerDeletedHistoryRefs();
    historyList.forEach((order) => {
      if (!deletedRefs.includes(order.orderReference)) {
        deletedRefs.push(order.orderReference);
      }
      removeSessionOrderRef(order.orderReference);
      updateOrder(order.orderReference, { customerDeletedHistory: true });
      if (order.status === 'cancelled' && !isCapturedReturnedBill(order)) {
        deleteOrder(order.orderReference);
      }
    });

    localStorage.setItem(CUSTOMER_DELETED_HISTORY_KEY, JSON.stringify(deletedRefs));
    notifyOrdersUpdated();
    return true;
  } catch (err) {
    console.error('Failed to clear customer order history:', err);
    return false;
  }
}

/**
 * Admin: Confirms an order, sets confirmedAt, and officially processes/captures customer payment!
 */
export function adminConfirmOrder(orderReference: string): OrderRecord | null {
  const existing = getOrder(orderReference);
  const now = new Date().toISOString();
  const isCardPayment = existing?.paymentMethod === 'card' && existing?.orderType !== 'pickup';
  return updateOrder(orderReference, {
    status: 'confirmed',
    confirmedAt: now,
    paidAt: isCardPayment ? now : undefined,
    updatedAt: now,
  });
}

/**
 * Admin: Sends order into kitchen preparation queue
 */
export function adminSetPreparing(orderReference: string): OrderRecord | null {
  const now = new Date().toISOString();
  return updateOrder(orderReference, {
    status: 'preparing',
    preparingAt: now,
    updatedAt: now,
  });
}

/**
 * Admin: Marks order as handed over to delivery partner / on the way
 */
export function adminSetOnTheWay(orderReference: string): OrderRecord | null {
  const now = new Date().toISOString();
  return updateOrder(orderReference, {
    status: 'on_the_way',
    onTheWayAt: now,
    updatedAt: now,
  });
}

/**
 * Admin: Marks order as completed / delivered
 */
export function adminSetDelivered(orderReference: string): OrderRecord | null {
  const now = new Date().toISOString();
  const existing = getOrder(orderReference);
  return updateOrder(orderReference, {
    status: 'delivered',
    // Cash / counter orders are paid on hand-over; keep an earlier card capture time as is
    paidAt: existing?.paidAt || now,
    deliveredAt: now,
    updatedAt: now,
  });
}

/**
 * Admin: Cancels order with formal reason and generates apology / inconvenience email.
 * If the cancelled order was paid by card and was confirmed/captured, it is queued for refund in Returned Bills.
 */
export function adminCancelOrderWithReason(
  orderReference: string,
  reason: string,
  emailContent?: string
): OrderRecord | null {
  const now = new Date().toISOString();
  const all = getAllOrders();
  const existing = all[orderReference];
  if (!existing) return null;

  const updates: Partial<OrderRecord> = {
    ...cancellationUpdates(existing, reason, now),
    // Default to a message written for the order *after* cancelling, so a captured
    // card payment is described as a pending refund (not "no payment was captured")
    inconvenienceEmailContent: emailContent ?? buildCancellationMessage(existing, reason).body,
  };

  return updateOrder(orderReference, updates);
}

/**
 * Field changes for an admin cancellation. Only a card payment that was already
 * captured (card delivery order confirmed by the parlour) becomes a pending refund;
 * orders cancelled before confirmation were never charged.
 */
function cancellationUpdates(existing: OrderRecord, reason: string, now: string): Partial<OrderRecord> {
  const isCardCaptured =
    existing.paymentMethod === 'card' &&
    existing.orderType !== 'pickup' &&
    Boolean(existing.confirmedAt) &&
    existing.status !== 'pending_confirmation';
  return {
    status: 'cancelled',
    cancelledAt: now,
    cancelledBy: 'admin',
    cancellationReason: reason,
    updatedAt: now,
    refundStatus: isCardCaptured ? 'pending' : undefined,
    refundAmountLKR: isCardCaptured ? existing.grandTotalLKR : undefined,
  };
}

/** True when cancelling this order now would put a refund in the Refunds list. */
export function cancellationNeedsRefund(order: OrderRecord): boolean {
  return cancellationUpdates(order, '', new Date().toISOString()).refundStatus === 'pending';
}

/** The customer message for cancelling this order, written as if it is already cancelled. */
export function buildCancellationMessage(order: OrderRecord, reason: string): { subject: string; body: string } {
  return generateInconvenienceEmail({ ...order, ...cancellationUpdates(order, reason, new Date().toISOString()) }, reason);
}

/**
 * Admin: Marks a returned bill's card refund as completed / settled
 */
export function completeOrderRefund(orderReference: string): OrderRecord | null {
  const now = new Date().toISOString();
  return updateOrder(orderReference, {
    refundStatus: 'completed',
    refundedAt: now,
    updatedAt: now,
  });
}

/**
 * Admin: Manually creates a new Return Bill (e.g. for walk-in returns or manual credit notes)
 */
export function createManualReturnBill(data: {
  orderReference?: string;
  customerName: string;
  contactNumber: string;
  branchId: BranchId;
  refundAmountLKR: number;
  paymentMethod: 'card' | 'cash';
  cancellationReason: string;
}): OrderRecord {
  // Never reuse an existing reference — saving would overwrite that order
  const wanted = data.orderReference?.trim();
  const ref = wanted && !getOrder(wanted) ? wanted : generateOrderReference('RET');
  const now = new Date().toISOString();
  const branch = AMORE_BRANCHES.find((b) => b.id === data.branchId) || AMORE_BRANCHES[0];

  const newReturnBill: OrderRecord = {
    orderReference: ref,
    createdAt: now,
    customerName: data.customerName.trim(),
    contactNumber: data.contactNumber.trim(),
    orderType: 'pickup',
    branchId: data.branchId,
    branchName: branch.name,
    branchCity: branch.city,
    items: [
      {
        itemId: 'returned-item-manual',
        name: 'Manual Return / Refund Item',
        category: 'returns',
        priceLKR: data.refundAmountLKR,
        quantity: 1,
        notes: data.cancellationReason,
      },
    ],
    subtotalLKR: data.refundAmountLKR,
    deliveryFeeLKR: 0,
    grandTotalLKR: data.refundAmountLKR,
    currency: 'LKR',
    status: 'cancelled',
    cancelledAt: now,
    cancelledBy: 'admin',
    cancellationReason: data.cancellationReason.trim(),
    paymentMethod: data.paymentMethod,
    refundStatus: 'pending',
    refundAmountLKR: data.refundAmountLKR,
    confirmedAt: now,
    updatedAt: now,
  };

  saveOrder(newReturnBill);
  return newReturnBill;
}

/**
 * Admin: Updates an existing Return Bill's amount or reason
 */
export function updateReturnBill(
  orderReference: string,
  updates: {
    refundAmountLKR?: number;
    cancellationReason?: string;
    customerName?: string;
    contactNumber?: string;
  }
): OrderRecord | null {
  const now = new Date().toISOString();
  const existing = getOrder(orderReference);
  // A manual refund record's "total" is the refund itself. For a refund on a real order,
  // keep the order's own totals so a partial refund doesn't erase the original sale.
  const isManualRecord =
    orderReference.startsWith('RET-') || Boolean(existing?.items?.some((i) => i.itemId === 'returned-item-manual'));
  return updateOrder(orderReference, {
    ...updates,
    ...(updates.refundAmountLKR !== undefined && isManualRecord
      ? { grandTotalLKR: updates.refundAmountLKR, subtotalLKR: updates.refundAmountLKR }
      : {}),
    updatedAt: now,
  });
}

/**
 * Builds the official Amore Inconvenience & Apology Email
 * Formatted strictly in accordance with Amore's Card Return & Refund Policy (with explicit refund days)
 */
export function generateInconvenienceEmail(
  order: OrderRecord,
  reason: string
): { subject: string; body: string } {
  const isReturnedBill = isCapturedReturnedBill(order);

  const refundAmt = order.refundAmountLKR || order.grandTotalLKR || 0;
  const formattedAmt = `LKR ${refundAmt.toLocaleString()}`;
  const cardDetails = order.cardLast4
    ? `${order.cardBrand || 'Card'} •••• ${order.cardLast4}`
    : 'your original payment card';

  let subject = `Your Amore order ${order.orderReference} has been cancelled`;
  let paymentNotice = '';

  if (isReturnedBill) {
    subject = `Refund for your Amore order ${order.orderReference}`;
    paymentNotice = `Your refund: we are refunding the full ${formattedAmt} to ${cardDetails}. It usually reaches your account within 2–3 working days, depending on your bank.`;
  } else if (order.paymentMethod === 'card') {
    paymentNotice = `Payment: your card was not charged for this order.`;
  } else {
    paymentNotice = `Payment: you have not been charged and there is nothing to pay.`;
  }

  const branch = AMORE_BRANCHES.find((b) => b.id === order.branchId) || AMORE_BRANCHES[0];
  const branchTitle = order.branchName || branch.name;

  const body = `Dear ${order.customerName},

We're very sorry, but we can't complete your order ${order.orderReference} from Amore ${branchTitle}.

Reason: ${reason}

${paymentNotice}

We're sorry for the inconvenience and hope to serve you again soon.

If you have any questions, please call or WhatsApp us on ${branch.phone}.

Warm regards,
The Amore team
Amore Speciality Ice Cream, Coffee & Cakes · ${branchTitle}`;

  return { subject, body };
}

/**
 * Admin: Update order status with timestamp
 */
export function updateOrderStatus(
  orderReference: string,
  status: OrderRecord['status']
): OrderRecord | null {
  const now = new Date().toISOString();
  const updates: Partial<OrderRecord> = {
    status,
    updatedAt: now,
  };
  if (status === 'confirmed') {
    updates.confirmedAt = now;
    updates.paidAt = now;
  } else if (status === 'preparing') {
    updates.preparingAt = now;
  } else if (status === 'on_the_way') {
    updates.onTheWayAt = now;
  } else if (status === 'delivered') {
    updates.deliveredAt = now;
  }
  return updateOrder(orderReference, updates);
}

/**
 * Admin: Create a manual phone or walk-in order
 */
export function createAdminOrder(orderData: Partial<OrderRecord>): OrderRecord {
  const orderRef = orderData.orderReference || generateOrderReference('AMO-M');
  const now = new Date().toISOString();
  const branch = AMORE_BRANCHES.find((b) => b.id === orderData.branchId) || AMORE_BRANCHES[0];

  const fullOrder: OrderRecord = {
    orderReference: orderRef,
    createdAt: now,
    customerName: orderData.customerName || 'Walk-in Customer',
    contactNumber: orderData.contactNumber || '+94 77 123 4567',
    orderType: orderData.orderType || 'pickup',
    deliveryAddress: orderData.deliveryAddress || '',
    city: orderData.city || '',
    branchId: branch.id,
    branchName: orderData.branchName || branch.name,
    branchCity: orderData.branchCity || branch.city,
    items: orderData.items || [],
    subtotalLKR: orderData.subtotalLKR || 0,
    deliveryFeeLKR: orderData.deliveryFeeLKR || 0,
    grandTotalLKR: orderData.grandTotalLKR || 0,
    currency: orderData.currency || 'LKR',
    status: orderData.status || 'confirmed',
    paymentMethod: orderData.paymentMethod || (orderData.orderType === 'pickup' ? 'pay_at_parlour' : 'cash'),
    specialNote: orderData.specialNote || 'Manual Admin Order',
    ...(orderData.confirmedAt ? { confirmedAt: orderData.confirmedAt } : {}),
    updatedAt: now,
  };

  saveOrder(fullOrder);
  return fullOrder;
}

/**
 * Builds the URL link for order confirmation that can be sent via WhatsApp or Email.
 * Also includes safe base64 encoded minimal order info in `orderData` so the recipient
 * can open it even on another device or private browsing window without losing their cart!
 */
export function generateConfirmationLink(order: OrderRecord): string {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  
  // Compact payload for cross-device support
  const compactPayload = {
    ref: order.orderReference,
    name: order.customerName,
    phone: order.contactNumber,
    type: order.orderType,
    addr: order.deliveryAddress,
    city: order.city,
    branchId: order.branchId,
    branchName: order.branchName,
    branchCity: order.branchCity,
    items: order.items.map((i) => ({
      id: i.itemId,
      n: i.name,
      fmt: i.format,
      p: i.priceLKR,
      q: i.quantity,
      img: i.image,
    })),
    sub: order.subtotalLKR,
    del: order.deliveryFeeLKR,
    tot: order.grandTotalLKR,
    cur: order.currency,
  };

  try {
    const serialized = encodeURIComponent(btoa(JSON.stringify(compactPayload)));
    return `${origin}${pathname}?confirmOrder=${encodeURIComponent(order.orderReference)}&d=${serialized}`;
  } catch {
    return `${origin}${pathname}?confirmOrder=${encodeURIComponent(order.orderReference)}`;
  }
}

/**
 * Recovers an order by either local storage or url-encoded payload
 */
export function recoverOrderByReference(orderReference: string, searchParams?: URLSearchParams): OrderRecord | null {
  // 1. First attempt localStorage
  const saved = getOrder(orderReference);
  if (saved) return saved;

  // 2. Try URL query payload 'd'
  if (searchParams && searchParams.get('d')) {
    try {
      const raw = atob(decodeURIComponent(searchParams.get('d')!));
      const parsed = JSON.parse(raw);
      if (parsed && parsed.ref === orderReference) {
        const reconstructed: OrderRecord = {
          orderReference: parsed.ref,
          createdAt: new Date().toISOString(),
          customerName: parsed.name,
          contactNumber: parsed.phone,
          orderType: parsed.type,
          deliveryAddress: parsed.addr,
          city: parsed.city,
          branchId: parsed.branchId,
          branchName: parsed.branchName,
          branchCity: parsed.branchCity,
          items: (parsed.items || []).map((i: any) => ({
            itemId: i.id,
            name: i.n,
            format: i.fmt,
            priceLKR: i.p,
            quantity: i.q,
            image: i.img,
            category: 'scoops',
          })),
          subtotalLKR: parsed.sub,
          deliveryFeeLKR: parsed.del,
          grandTotalLKR: parsed.tot,
          currency: parsed.cur || 'LKR',
          status: 'pending_confirmation',
        };
        // Cache it on this device only. Saving it to Firestore would overwrite the real
        // order (status, timestamps) with this partial copy from the link.
        const all = getAllOrders();
        all[reconstructed.orderReference] = reconstructed;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        recordSessionOrderRef(reconstructed.orderReference);
        return reconstructed;
      }
    } catch (err) {
      console.error('Failed to parse URL order payload:', err);
    }
  }

  return null;
}
