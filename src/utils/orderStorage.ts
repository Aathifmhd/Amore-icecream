import { OrderRecord } from '../types';
import {
  saveOrderToFirestore,
  updateOrderInFirestore,
  deleteOrderFromFirestore,
  auth,
} from '../firebase';

const STORAGE_KEY = 'amore_orders_v1';

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
export function cancelOrder(orderReference: string): OrderRecord | null {
  return updateOrder(orderReference, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
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
