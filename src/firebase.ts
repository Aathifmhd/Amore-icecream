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
  deleteDoc,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { OrderRecord } from './types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// CRITICAL: Connect directly to the specific Firestore Database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
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
    const effectiveUid = userId || order.userId || auth.currentUser?.uid;
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
    if (effectiveUid) payload.userId = effectiveUid;
    if (order.cancelledBy) payload.cancelledBy = order.cancelledBy;
    if (order.cancellationReason) payload.cancellationReason = order.cancellationReason;
    if (order.inconvenienceEmailContent) payload.inconvenienceEmailContent = order.inconvenienceEmailContent;
    if (order.confirmedAt) payload.confirmedAt = order.confirmedAt;
    if (order.preparingAt) payload.preparingAt = order.preparingAt;
    if (order.deliveredAt) payload.deliveredAt = order.deliveredAt;
    if (order.cancelledAt) payload.cancelledAt = order.cancelledAt;

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
    const allowedUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) allowedUpdates.status = updates.status;
    if (updates.paidAt !== undefined) allowedUpdates.paidAt = updates.paidAt;
    if (updates.paymentMethod !== undefined) allowedUpdates.paymentMethod = updates.paymentMethod;
    if (updates.specialNote !== undefined) allowedUpdates.specialNote = updates.specialNote;
    if (updates.cardLast4 !== undefined) allowedUpdates.cardLast4 = updates.cardLast4;
    if (updates.cardBrand !== undefined) allowedUpdates.cardBrand = updates.cardBrand;
    if (updates.cancelledBy !== undefined) allowedUpdates.cancelledBy = updates.cancelledBy;
    if (updates.cancellationReason !== undefined) allowedUpdates.cancellationReason = updates.cancellationReason;
    if (updates.inconvenienceEmailContent !== undefined) allowedUpdates.inconvenienceEmailContent = updates.inconvenienceEmailContent;
    if (updates.confirmedAt !== undefined) allowedUpdates.confirmedAt = updates.confirmedAt;
    if (updates.preparingAt !== undefined) allowedUpdates.preparingAt = updates.preparingAt;
    if (updates.onTheWayAt !== undefined) allowedUpdates.onTheWayAt = updates.onTheWayAt;
    if (updates.deliveredAt !== undefined) allowedUpdates.deliveredAt = updates.deliveredAt;
    if (updates.cancelledAt !== undefined) allowedUpdates.cancelledAt = updates.cancelledAt;
    if (updates.deliveryAddress !== undefined) allowedUpdates.deliveryAddress = updates.deliveryAddress;
    if (updates.city !== undefined) allowedUpdates.city = updates.city;
    if (updates.contactNumber !== undefined) allowedUpdates.contactNumber = updates.contactNumber;
    if (updates.deliveryCoordinates !== undefined) allowedUpdates.deliveryCoordinates = updates.deliveryCoordinates;
    if (updates.createdAt !== undefined) allowedUpdates.createdAt = updates.createdAt;
    if (updates.isGracePeriodPaused !== undefined) allowedUpdates.isGracePeriodPaused = updates.isGracePeriodPaused;
    if (updates.gracePeriodRemainingSeconds !== undefined) allowedUpdates.gracePeriodRemainingSeconds = updates.gracePeriodRemainingSeconds;
    if (updates.gracePeriodPausedAt !== undefined) allowedUpdates.gracePeriodPausedAt = updates.gracePeriodPausedAt;
    if (updates.updatedAt !== undefined) allowedUpdates.updatedAt = updates.updatedAt;

    await updateDoc(doc(db, 'orders', orderReference), allowedUpdates);
    return true;
  } catch (error) {
    console.warn('Could not update order in Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } catch {
      // Ignore
    }
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

/**
 * Optimizes/compresses an image client-side before uploading.
 * Max dimensions: 1200x1200px, JPEG/WebP quality 0.85
 */
export async function compressImageClientSide(
  file: File | Blob,
  maxDimension = 1200,
  quality = 0.85
): Promise<Blob> {
  if (typeof window === 'undefined' || !window.createImageBitmap) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    return new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    });
  } catch (e) {
    console.warn('Client-side compression fallback to original:', e);
    return file;
  }
}

/**
 * Uploads a product image to Firebase Cloud Storage.
 * Generates an optimized image and returns the public download URL.
 * Resilient fallback: Converts to base64 Data URL if storage bucket fails/rules deny.
 */
export async function uploadProductImageToFirebase(
  file: File,
  folder = 'menu_catalog'
): Promise<{ url: string; storageType: 'firebase_storage' | 'base64_fallback' }> {
  const compressedBlob = await compressImageClientSide(file);
  const cleanFilename = file.name
    ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
    : 'product.jpg';
  const storagePath = `${folder}/${Date.now()}_${cleanFilename}`;

  try {
    const imageRef = storageRef(storage, storagePath);
    const snapshot = await uploadBytes(imageRef, compressedBlob, {
      contentType: 'image/jpeg',
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });
    const downloadURL = await getDownloadURL(snapshot.ref);
    return { url: downloadURL, storageType: 'firebase_storage' };
  } catch (storageError) {
    console.warn('Firebase Storage upload failed, falling back to base64 Data URL:', storageError);
    // Fallback to data URL so the admin is never blocked
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          url: reader.result as string,
          storageType: 'base64_fallback',
        });
      };
      reader.onerror = () => {
        resolve({
          url: 'https://images.unsplash.com/photo-1560008581-09826d1de69e?auto=format&fit=crop&w=600&q=80',
          storageType: 'base64_fallback',
        });
      };
      reader.readAsDataURL(compressedBlob);
    });
  }
}

/**
 * Safely deletes a file from Firebase Storage if it's hosted there
 */
export async function deleteProductImageFromFirebase(imageUrl: string): Promise<boolean> {
  if (!imageUrl || (!imageUrl.includes('firebasestorage.googleapis.com') && !imageUrl.includes('firebasestorage.app'))) {
    return false;
  }
  try {
    const imageRef = storageRef(storage, imageUrl);
    await deleteObject(imageRef);
    return true;
  } catch (e) {
    console.warn('Could not delete image from Firebase Storage:', e);
    return false;
  }
}
