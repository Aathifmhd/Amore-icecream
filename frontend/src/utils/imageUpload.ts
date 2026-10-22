/**
 * Menu photo uploads from the admin console. Photos are shrunk in the browser first
 * (max 1200 px, JPEG) and stored by the backend, which serves them at /api/images/<id>.
 */
import { api } from '../api';

/** Shrinks a photo to at most `maxDimension` px on its longer side, as a JPEG. */
export async function compressImageClientSide(file: File | Blob, maxDimension = 1200, quality = 0.85): Promise<Blob> {
  if (typeof window === 'undefined' || !window.createImageBitmap) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // JPEG has no transparency: put see-through PNGs on white instead of black
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality));
  } catch (e) {
    console.warn('Could not shrink the photo, uploading the original:', e);
    return file;
  }
}

/** Uploads a menu photo and returns its URL. Throws an ApiError if the upload fails. */
export async function uploadMenuPhoto(file: File): Promise<string> {
  const blob = await compressImageClientSide(file);
  const { url } = await api<{ url: string }>('/images', { method: 'POST', file: blob, as: 'admin' });
  return url;
}

/**
 * A small photo kept inside a private record (e.g. an employee), as a data URL, instead of
 * being uploaded where anyone with the link could see it.
 */
export async function photoDataUrl(file: File, maxDimension = 320): Promise<string> {
  const blob = await compressImageClientSide(file, maxDimension, 0.8);
  if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) throw new Error('Use a JPEG, PNG or WebP photo');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the photo'));
    reader.readAsDataURL(blob);
  });
}
