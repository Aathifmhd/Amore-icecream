/**
 * The photo gallery menu photos are picked from: Amore's own photos (built into the website)
 * plus the ones the super admin uploads in Settings → Photo gallery (kept on the server).
 */
import { useCallback, useEffect, useState } from 'react';
import { CATALOG_PRESET_IMAGES, type CatalogPresetImage } from '../../../data/iceCreamData';
import { api } from '../../../api';
import { uploadMenuPhoto } from '../../../utils/imageUpload';

export type GalleryCategory = CatalogPresetImage['category'];
export const GALLERY_CATEGORIES: GalleryCategory[] = ['Ice Cream Flavours', 'Specialty Coffee', 'Artisan Cakes', 'Brand Signatures'];

export interface GalleryPhoto {
  id: string;
  name: string;
  category: GalleryCategory;
  url: string;
  /** Built into the website (deleting one only hides it); otherwise uploaded by the super admin. */
  builtIn: boolean;
  createdAt?: string;
}

const BUILT_IN: GalleryPhoto[] = CATALOG_PRESET_IMAGES.map((p) => ({ id: p.id, name: p.name, category: p.category, url: p.url, builtIn: true }));

/**
 * Every gallery photo: uploaded ones first (newest first), then the built-in ones
 * (minus any the super admin deleted, which are only hidden).
 */
export function useGallery() {
  const [uploaded, setUploaded] = useState<GalleryPhoto[] | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    api<{ photos: Omit<GalleryPhoto, 'builtIn'>[]; hidden: string[]; waiting?: number }>('/gallery', { as: 'admin' })
      .then((r) => {
        setUploaded(r.photos.map((p) => ({ ...p, builtIn: false })));
        setHidden(r.hidden || []);
        setWaiting(r.waiting || 0);
      })
      .catch(() => {
        // The built-in photos still work without the server
        setUploaded([]);
        setError('Could not load the uploaded photos.');
      });
  }, []);

  useEffect(reload, [reload]);

  const builtIn = BUILT_IN.filter((p) => !hidden.includes(p.id));
  return {
    photos: [...(uploaded || []), ...builtIn],
    hiddenCount: BUILT_IN.length - builtIn.length,
    // Photos uploaded for menu items that aren't in the gallery yet
    waiting,
    loading: uploaded === null,
    error,
    reload,
  };
}

/** Upload a photo and add it to the gallery (super admin). */
export async function addGalleryPhoto(file: File, name: string, category: GalleryCategory): Promise<GalleryPhoto> {
  const url = await uploadMenuPhoto(file);
  const { photo } = await api<{ photo: Omit<GalleryPhoto, 'builtIn'> }>('/gallery', {
    method: 'POST',
    body: { url, name, category },
    as: 'admin',
  });
  return { ...photo, builtIn: false };
}

/** Put a photo already uploaded (e.g. for a menu item) into the gallery (super admin). */
export async function addUploadToGallery(url: string, name: string, category: GalleryCategory): Promise<void> {
  await api('/gallery', { method: 'POST', body: { url, name: name.trim().slice(0, 80) || 'Menu photo', category }, as: 'admin' });
}

/** Add every photo uploaded for menu items that isn't in the gallery yet (repeats are skipped). */
export async function addMenuUploadsToGallery(): Promise<{ added: number; skipped: number }> {
  return api('/gallery/add-uploads', { method: 'POST', as: 'admin' });
}

/** Delete a photo from the gallery (one of Amore's own photos is hidden instead). */
export async function removeGalleryPhoto(id: string): Promise<void> {
  await api(`/gallery/${encodeURIComponent(id)}`, { method: 'DELETE', as: 'admin' });
}

/** Bring back every deleted built-in photo. */
export async function restoreBuiltInPhotos(): Promise<void> {
  await api('/gallery/restore', { method: 'POST', as: 'admin' });
}
