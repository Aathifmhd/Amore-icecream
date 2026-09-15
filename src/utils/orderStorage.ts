import { OrderRecord, BranchId } from '../types';
import { AMORE_BRANCHES } from '../data/iceCreamData';
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

export function getAllOrders(): Record<string, OrderRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: Record<string, OrderRecord> = JSON.parse(raw);

    // Completely purge legacy test order AMO-3899 from local storage and firestore
    if (parsed['AMO-3899']) {
      delete parsed['AMO-3899'];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      deleteOrderFromFirestore('AMO-3899').catch(() => {});
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

    let filtered: OrderRecord[] = [];
    if (userId && userId.trim()) {
      // Authenticated user: must match user ID or be created in this browser session
      filtered = list.filter(
        (o) =>
          o.orderReference !== 'AMO-3899' &&
          (o.userId === userId || sessionRefs.includes(o.orderReference))
      );
    } else {
      // Unauthenticated visitor: ONLY orders placed in this specific browser session
      filtered = list.filter(
        (o) => o.orderReference !== 'AMO-3899' && sessionRefs.includes(o.orderReference)
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
  return updateOrder(orderReference, {
    status: 'delivered',
    paidAt: now,
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

  // STRICT USER POLICY:
  // "only sent the returned order which is already captured payment order by card payment...
  // thats mean cancel by owner after confirm the order and captured the payment.
  // Dont get not payment captured orders that's means cancel by admin before confirm the order"
  const isCardCaptured =
    existing.paymentMethod === 'card' &&
    existing.orderType !== 'pickup' &&
    Boolean(existing.confirmedAt) &&
    existing.status !== 'pending_confirmation';

  const updates: Partial<OrderRecord> = {
    status: 'cancelled',
    cancelledAt: now,
    cancelledBy: 'admin',
    cancellationReason: reason,
    inconvenienceEmailContent: emailContent,
    updatedAt: now,
  };

  if (isCardCaptured) {
    updates.refundStatus = 'pending';
    updates.refundAmountLKR = existing.grandTotalLKR;
  } else {
    updates.refundStatus = undefined;
    updates.refundAmountLKR = undefined;
  }

  return updateOrder(orderReference, updates);
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
  const ref = data.orderReference?.trim() || `RET-${Math.floor(1000 + Math.random() * 9000)}`;
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
  return updateOrder(orderReference, {
    ...updates,
    grandTotalLKR: updates.refundAmountLKR !== undefined ? updates.refundAmountLKR : undefined,
    subtotalLKR: updates.refundAmountLKR !== undefined ? updates.refundAmountLKR : undefined,
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

  let subject = `Notice regarding your Amore Order ${order.orderReference} - Cancellation & Sincere Apology`;
  let paymentNotice = '';

  if (isReturnedBill) {
    subject = `Refund Notice: Amore Order ${order.orderReference} - Returned Bill & Apology`;
    paymentNotice = `RETURN & REFUND NOTICE (In accordance with Amore Card Return Policy):
• 100% Refund Guarantee: Full refund of ${formattedAmt} has been officially approved.
• Refund Method: Reversal credited directly back to ${cardDetails}.
• Refund Processing Days: Funds will reflect in your account within 2 to 3 business days (depending on your card issuing bank).
• Accounting Record: Returned Bill & Credit Note #${order.orderReference} has been logged in our system.`;
  } else if (order.paymentMethod === 'card') {
    paymentNotice = `PAYMENT AUTHORIZATION NOTICE:
• Your card pre-authorization hold for ${formattedAmt} was voided immediately upon cancellation.
• No payment was captured and no charges were made to your account.`;
  } else if (order.orderType === 'pickup' || order.paymentMethod === 'pay_at_parlour') {
    paymentNotice = `PAYMENT NOTICE:
• As you selected Pay at the Parlour, your order was cancelled with zero fee and no payment obligation.`;
  } else {
    paymentNotice = `PAYMENT NOTICE:
• As you selected Cash on Delivery, your order was cancelled with zero fee and no payment obligation.`;
  }

  const branchTitle = order.branchName || 'Akurana Flagship';

  const body = `From: zenatiqcodes@gmail.com
To: ${order.emailAddress || order.customerName}
Subject: ${subject}

Dear ${order.customerName},

We sincerely apologize, but we are unable to process and fulfill your order (${order.orderReference}) placed with Amore Speciality Ice Cream (${branchTitle}).

Reason for cancellation:
"${reason}"

${paymentNotice}

Amore Return Policy Commitment:
Under our 100% Refund Policy, any order cancelled after payment authorization is guaranteed a full, prompt reversal within 2 to 3 business days. Every batch at Amore is churned fresh with authentic artisanal ingredients, and we deeply regret any inconvenience or disruption this has caused to your day. We look forward to the honor of serving you an exceptional experience on your next visit.

If you have any questions regarding your refund or need immediate assistance, please reply directly to this email at zenatiqcodes@gmail.com or contact our parlour counter.

Warm regards,
The Amore Parlour Team
zenatiqcodes@gmail.com
Amore Speciality Ice Cream, Coffee & Cakes
${branchTitle} • Hotline: +94 81 230 4567`;

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
  const refNum = Math.floor(1000 + Math.random() * 9000);
  const orderRef = orderData.orderReference || `AMO-M${refNum}`;
  const now = new Date().toISOString();

  const fullOrder: OrderRecord = {
    orderReference: orderRef,
    createdAt: now,
    customerName: orderData.customerName || 'Walk-in Customer',
    contactNumber: orderData.contactNumber || '+94 77 123 4567',
    orderType: orderData.orderType || 'pickup',
    deliveryAddress: orderData.deliveryAddress || '',
    city: orderData.city || '',
    branchId: orderData.branchId || 'akurana',
    branchName: orderData.branchName || 'Akurana Flagship',
    branchCity: orderData.branchCity || 'Kandy Hills',
    items: orderData.items || [],
    subtotalLKR: orderData.subtotalLKR || 0,
    deliveryFeeLKR: orderData.deliveryFeeLKR || 0,
    grandTotalLKR: orderData.grandTotalLKR || 0,
    currency: orderData.currency || 'LKR',
    status: orderData.status || 'confirmed',
    paymentMethod: orderData.paymentMethod || (orderData.orderType === 'pickup' ? 'pay_at_parlour' : 'cash'),
    specialNote: orderData.specialNote || 'Manual Admin Order',
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
        // Also cache it
        saveOrder(reconstructed);
        return reconstructed;
      }
    } catch (err) {
      console.error('Failed to parse URL order payload:', err);
    }
  }

  return null;
}
