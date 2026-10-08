/**
 * Firebase Storage helpers for menu photos. Kept apart from firebase.ts so the
 * Storage SDK only downloads with the admin console, not for every customer.
 */
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { app } from './firebase';

export const storage = getStorage(app);

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
