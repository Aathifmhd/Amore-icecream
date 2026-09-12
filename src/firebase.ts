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
  getDocFromServer,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { OrderRecord } from './types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

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

// Test Connection on Boot as mandated by Skill
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// ==========================================
// FIRESTORE REPOSITORY HELPERS FOR AMORE
// ==========================================

/**
 * Save an order directly to Cloud Firestore with fallbacks
 */
export async function saveOrderToFirestore(order: OrderRecord, userId?: string): Promise<boolean> {
  const path = `orders/${order.orderReference}`;
  try {
    const payload: Record<string, unknown> = {
      orderReference: order.orderReference,
      createdAt: order.createdAt || new Date().toISOString(),
      customerName: order.customerName,
      contactNumber: order.contactNumber,
      orderType: order.orderType,
      branchId: order.branchId,
      branchName: order.branchName,
      branchCity: order.branchCity,
      items: order.items,
      subtotalLKR: order.subtotalLKR,
      deliveryFeeLKR: order.deliveryFeeLKR,
      grandTotalLKR: order.grandTotalLKR,
      currency: order.currency,
      status: order.status,
    };

    if (order.whatsappNumber) payload.whatsappNumber = order.whatsappNumber;
    if (order.emailAddress) payload.emailAddress = order.emailAddress;
    if (order.deliveryAddress) payload.deliveryAddress = order.deliveryAddress;
    if (order.city) payload.city = order.city;
    if (order.specialNote) payload.specialNote = order.specialNote;
    if (order.paymentMethod) payload.paymentMethod = order.paymentMethod;
    if (order.paidAt) payload.paidAt = order.paidAt;
    if (order.cardLast4) payload.cardLast4 = order.cardLast4;
    if (order.cardBrand) payload.cardBrand = order.cardBrand;
    if (userId) payload.userId = userId;

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
 * Update an order in Firestore (e.g. mark as paid, confirm status)
 */
export async function updateOrderInFirestore(
  orderReference: string,
  updates: Partial<OrderRecord>
): Promise<boolean> {
  const path = `orders/${orderReference}`;
  try {
    const allowedUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) allowedUpdates.status = updates.status;
    if (updates.paidAt !== undefined) allowedUpdates.paidAt = updates.paidAt;
    if (updates.paymentMethod !== undefined) allowedUpdates.paymentMethod = updates.paymentMethod;
    if (updates.specialNote !== undefined) allowedUpdates.specialNote = updates.specialNote;
    if (updates.cardLast4 !== undefined) allowedUpdates.cardLast4 = updates.cardLast4;
    if (updates.cardBrand !== undefined) allowedUpdates.cardBrand = updates.cardBrand;

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
        console.warn('Order subscription error:', error);
        handleFirestoreError(error, OperationType.GET, path);
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
