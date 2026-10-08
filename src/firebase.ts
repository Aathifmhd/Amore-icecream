import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteField,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { OrderRecord } from './types';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// CRITICAL: Connect directly to the specific Firestore Database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type User,
};

// Standardized Operation Types & Error Handling as mandated by the Firebase skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ==========================================
// FIRESTORE REPOSITORY HELPERS FOR AMORE
// ==========================================

// Every field an order document may hold (mirrors OrderRecord).
const ORDER_FIELDS: (keyof OrderRecord)[] = [
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

// Fields that callers clear by passing `undefined` (e.g. a refund that no longer applies).
const CLEARABLE_ORDER_FIELDS = new Set<keyof OrderRecord>(['refundStatus', 'refundAmountLKR', 'paidAt']);

// Firestore rejects `undefined`, so drop it (or turn it into a delete when clearing is intended).
function toOrderPayload(data: Partial<OrderRecord>, forUpdate: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of ORDER_FIELDS) {
    if (!(key in data)) continue;
    const value = data[key];
    if (value === undefined) {
      if (forUpdate && CLEARABLE_ORDER_FIELDS.has(key)) payload[key] = deleteField();
      continue;
    }
    payload[key] = value;
  }
  return payload;
}

/**
 * Save an order directly to Cloud Firestore with fallbacks
 */
export async function saveOrderToFirestore(order: OrderRecord, userId?: string): Promise<boolean> {
  const path = `orders/${order.orderReference}`;
  try {
    const effectiveUid = userId || order.userId || auth.currentUser?.uid;
    const payload = toOrderPayload(
      { ...order, createdAt: order.createdAt || new Date().toISOString() },
      false
    );
    if (effectiveUid) payload.userId = effectiveUid;

    await setDoc(doc(db, 'orders', order.orderReference), payload);
    return true;
  } catch (error) {
    console.warn('Could not save order to Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Continue execution so user experience is not blocked
    }
    return false;
  }
}

/**
 * Retrieve an order from Firestore by its reference
 */
export async function getOrderFromFirestore(orderReference: string): Promise<OrderRecord | null> {
  const path = `orders/${orderReference}`;
  try {
    const docSnap = await getDoc(doc(db, 'orders', orderReference));
    if (docSnap.exists()) {
      return docSnap.data() as OrderRecord;
    }
    return null;
  } catch (error) {
    console.warn('Could not fetch order from Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch {
      // Return null so fallback recovers
    }
    return null;
  }
}

/**
 * Update an order in Firestore (e.g. mark as paid, confirm status, cancel)
 */
export async function updateOrderInFirestore(
  orderReference: string,
  updates: Partial<OrderRecord>
): Promise<boolean> {
  const path = `orders/${orderReference}`;
  try {
    const { orderReference: _ref, userId: _uid, ...rest } = updates;
    const allowedUpdates = toOrderPayload(rest, true);
    if (Object.keys(allowedUpdates).length === 0) return true;

    await updateDoc(doc(db, 'orders', orderReference), allowedUpdates);
    return true;
  } catch (error) {
    console.warn('Could not update order in Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } catch {
      // Ignore
    }
    return false;
  }
}

/**
 * Live subscribe to an order for real-time status updates (e.g. on confirmation page)
 */
export function subscribeToOrder(
  orderReference: string,
  callback: (order: OrderRecord | null) => void
): () => void {
  const path = `orders/${orderReference}`;
  try {
    const unsubscribe = onSnapshot(
      doc(db, 'orders', orderReference),
      (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as OrderRecord);
        } else {
          callback(null);
        }
      },
      (error) => {
        // Expected when viewing someone else's order link: the page falls back to the link's data
        console.warn(`Order subscription error (${path}):`, error);
      }
    );
    return unsubscribe;
  } catch (error) {
    console.warn('Failed to subscribe to order in Firestore:', error);
    return () => {};
  }
}

/**
 * Get all orders placed by an authenticated user
 */
export async function getUserOrdersFromFirestore(userId: string): Promise<OrderRecord[]> {
  const path = 'orders';
  try {
    const q = query(collection(db, 'orders'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const orders: OrderRecord[] = [];
    querySnapshot.forEach((d) => {
      orders.push(d.data() as OrderRecord);
    });
    return orders;
  } catch (error) {
    console.warn('Could not query user orders from Firestore:', error);
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Delete an order from Firestore
 */
export async function deleteOrderFromFirestore(orderReference: string): Promise<boolean> {
  const path = `orders/${orderReference}`;
  try {
    await deleteDoc(doc(db, 'orders', orderReference));
    return true;
  } catch (error) {
    console.warn('Could not delete order from Firestore:', error);
    return false;
  }
}

/**
 * Admin: fetch all orders from Firestore
 */
export async function getAllOrdersFromFirestore(): Promise<OrderRecord[]> {
  const path = 'orders';
  try {
    const q = query(collection(db, 'orders'));
    const querySnapshot = await getDocs(q);
    const orders: OrderRecord[] = [];
    querySnapshot.forEach((d) => {
      orders.push(d.data() as OrderRecord);
    });
    return orders;
  } catch (error) {
    console.warn('Could not fetch all orders from Firestore:', error);
    return [];
  }
}

/**
 * Admin: Real-time subscription to all orders in Firestore
 */
export function subscribeToAllOrders(callback: (orders: OrderRecord[]) => void): () => void {
  try {
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders: OrderRecord[] = [];
        snapshot.forEach((doc) => {
          orders.push(doc.data() as OrderRecord);
        });
        callback(orders);
      },
      (err) => {
        console.warn('Real-time orders subscription error:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to all orders:', err);
    return () => {};
  }
}

/**
 * Customer: Real-time subscription to user orders in Firestore
 */
export function subscribeToUserOrders(
  userId: string,
  callback: (orders: OrderRecord[]) => void
): () => void {
  try {
    const q = query(collection(db, 'orders'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders: OrderRecord[] = [];
        snapshot.forEach((doc) => {
          orders.push(doc.data() as OrderRecord);
        });
        callback(orders);
      },
      (err) => {
        console.warn('Real-time user orders subscription error:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to user orders:', err);
    return () => {};
  }
}

/**
 * Fetch all custom/updated menu items from Firestore
 */
export async function getAllMenuItemsFromFirestore(): Promise<any[]> {
  try {
    const q = query(collection(db, 'menu_items'));
    const querySnapshot = await getDocs(q);
    const items: any[] = [];
    querySnapshot.forEach((d) => {
      items.push({ ...d.data(), id: d.id });
    });
    return items;
  } catch (err) {
    console.warn('Could not fetch menu items from Firestore:', err);
    return [];
  }
}

/**
 * Real-time subscription to all menu items in Firestore
 */
export function subscribeToMenuItems(callback: (items: any[]) => void): () => void {
  try {
    const q = query(collection(db, 'menu_items'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((d) => {
          items.push({ ...d.data(), id: d.id });
        });
        callback(items);
      },
      (err) => {
        console.warn('Real-time menu subscription error:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to menu items:', err);
    return () => {};
  }
}
