import { OrderRecord } from '../types';
import {
  saveOrderToFirestore,
  updateOrderInFirestore,
  deleteOrderFromFirestore,
  auth,
} from '../firebase';

const STORAGE_KEY = 'amore_orders_v1';
export const ORDERS_UPDATED_EVENT = 'amore_orders_updated';

export function notifyOrdersUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
  }
}

export function getAllOrders(): Record<string, OrderRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load orders from localStorage:', err);
    return {};
  }
}

export function saveOrder(order: OrderRecord): void {
  try {
    const all = getAllOrders();
    all[order.orderReference] = order;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    notifyOrdersUpdated();
  } catch (err) {
    console.error('Failed to save order to localStorage:', err);
  }

  // Asynchronously persist to Cloud Firestore
  try {
    const currentUid = auth.currentUser?.uid;
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
 * Returns a list of all orders sorted newest to oldest.
 * Optionally filters by userId.
 */
export function getUserOrdersList(userId?: string | null): OrderRecord[] {
  try {
    const all = getAllOrders();
    const list = Object.values(all);
    const filtered = userId ? list.filter((o) => !o.userId || o.userId === userId) : list;
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
  }
): OrderRecord | null {
  return updateOrder(orderReference, {
    ...details,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Admin: Get all orders across all users sorted newest first
 */
export function getAllOrdersAdmin(): OrderRecord[] {
  try {
    const all = getAllOrders();
    const list = Object.values(all);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('Failed to get all orders for admin:', err);
    return [];
  }
}

/**
 * Admin: Permanently delete an order from storage & firestore
 */
export function deleteOrder(orderReference: string): boolean {
  try {
    const all = getAllOrders();
    if (all[orderReference]) {
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
  const now = new Date().toISOString();
  return updateOrder(orderReference, {
    status: 'confirmed',
    confirmedAt: now,
    paidAt: now,
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
 * Admin: Marks order as completed / delivered
 */
export function adminSetDelivered(orderReference: string): OrderRecord | null {
  const now = new Date().toISOString();
  return updateOrder(orderReference, {
    status: 'delivered',
    deliveredAt: now,
    updatedAt: now,
  });
}

/**
 * Admin: Cancels order with formal reason and generates apology / inconvenience email
 */
export function adminCancelOrderWithReason(
  orderReference: string,
  reason: string,
  emailContent?: string
): OrderRecord | null {
  const now = new Date().toISOString();
  return updateOrder(orderReference, {
    status: 'cancelled',
    cancelledAt: now,
    cancelledBy: 'admin',
    cancellationReason: reason,
    inconvenienceEmailContent: emailContent,
    updatedAt: now,
  });
}

/**
 * Builds the official Amore Inconvenience & Apology Email
 */
export function generateInconvenienceEmail(
  order: OrderRecord,
  reason: string
): { subject: string; body: string } {
  const subject = `Notice regarding your Amore Order ${order.orderReference} - Cancellation & Sincere Apology`;
  const paymentNotice =
    order.paymentMethod === 'card'
      ? 'Your card payment authorization has been immediately voided and no charges were made.'
      : 'As you selected Cash on Delivery, your order has been cancelled with no obligation or fee.';

  const body = `Dear ${order.customerName},

We sincerely apologize, but we are unable to process your order (${order.orderReference}) placed for Amore Speciality Ice Cream (${order.branchName}).

Reason for cancellation:
"${reason}"

Payment Information:
${paymentNotice}

We deeply regret any inconvenience this may cause to your day or gathering. Every batch at Amore is churned fresh with authentic artisanal ingredients, and we hope to have the pleasure of serving you again soon.

If you have any questions or need immediate assistance, please reply directly or contact our parlour manager.

Warm regards,
The Amore Parlour Team
Amore Speciality Ice Cream, Coffee & Cakes
${order.branchName} • Hotline: ${order.contactNumber || '+94 81 230 4567'}`;

  return { subject, body };
}

/**
 * Admin: Update order status with timestamp
 */
export function updateOrderStatus(
  orderReference: string,
  status: OrderRecord['status']
): OrderRecord | null {
  return updateOrder(orderReference, {
    status,
    updatedAt: new Date().toISOString(),
  });
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
    paymentMethod: orderData.paymentMethod || 'cash',
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
