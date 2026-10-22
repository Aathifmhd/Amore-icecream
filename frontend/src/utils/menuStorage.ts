import { ScoopItem, MenuItem } from '../types';
import {
  ALL_20_FLAVOURS,
  SPECIALTY_COFFEE_ITEMS,
  ARTISAN_CAKES_ITEMS,
  resolveBundledImage,
} from '../data/iceCreamData';
import { api } from '../api';
import { pendingWritePaths, queueWrite } from './outbox';
import { sharedPoller, startPolling } from './poll';

const SCOOPS_STORAGE_KEY = 'amore_menu_scoops_v1';
const COFFEE_STORAGE_KEY = 'amore_menu_coffee_v1';
const CAKES_STORAGE_KEY = 'amore_menu_cakes_v1';

export const MENU_UPDATED_EVENT = 'amore_menu_updated';

/**
 * Browsers keep a copy of the menu from their first visit. Bump this whenever the
 * built-in menu in iceCreamData.ts changes so returning visitors drop their stale
 * copy; admin edits live on the server (MongoDB) and are merged back in on the next sync.
 */
const MENU_DEFAULTS_VERSION = '2026-10-22-mongodb';
const MENU_DEFAULTS_VERSION_KEY = 'amore_menu_defaults_version';

try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(MENU_DEFAULTS_VERSION_KEY) !== MENU_DEFAULTS_VERSION) {
    localStorage.removeItem(SCOOPS_STORAGE_KEY);
    localStorage.removeItem(COFFEE_STORAGE_KEY);
    localStorage.removeItem(CAKES_STORAGE_KEY);
    localStorage.setItem(MENU_DEFAULTS_VERSION_KEY, MENU_DEFAULTS_VERSION);
  }
} catch {
  // Storage blocked (private mode etc.) — the built-in menu is used directly
}

// Fix photo links saved against an older build (see resolveBundledImage)
function withCurrentImage<T extends { image?: string }>(item: T): T {
  const image = resolveBundledImage(item.image);
  return image === item.image ? item : { ...item, image };
}

const menuPath = (id: string) => `/menu/${encodeURIComponent(id)}`;

/** Save an item on the server (shown here at once; sent in the background). */
function pushItem(item: { id: string }, itemType: 'scoop' | 'coffee' | 'cake') {
  queueWrite({ method: 'PUT', path: menuPath(item.id), body: { ...item, itemType } });
}

/** Delete on the server: it keeps a marker so every device drops the item. */
function pushDelete(id: string) {
  queueWrite({ method: 'DELETE', path: menuPath(id) });
}

function notifyMenuUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MENU_UPDATED_EVENT));
    try {
      localStorage.setItem('amore_menu_sync_timestamp', Date.now().toString());
    } catch {}
  }
}

// ----------------------------------------------------
// SCOOPS / GELATO FLAVOURS CRUD
// ----------------------------------------------------

export function getAllGelatoFlavours(): ScoopItem[] {
  try {
    const raw = localStorage.getItem(SCOOPS_STORAGE_KEY);
    if (!raw) {
      // Seed with default 20 flavours
      localStorage.setItem(SCOOPS_STORAGE_KEY, JSON.stringify(ALL_20_FLAVOURS));
      return ALL_20_FLAVOURS;
    }
    const parsed: ScoopItem[] = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(withCurrentImage) : ALL_20_FLAVOURS;
  } catch (err) {
    console.error('Failed to load scoops from storage:', err);
    return ALL_20_FLAVOURS;
  }
}

export function saveAllGelatoFlavours(items: ScoopItem[]): void {
  try {
    localStorage.setItem(SCOOPS_STORAGE_KEY, JSON.stringify(items));
    notifyMenuUpdated();
  } catch (err) {
    console.error('Failed to save scoops:', err);
  }
}

export function createScoopItem(item: ScoopItem): ScoopItem {
  const current = getAllGelatoFlavours();
  // Ensure unique ID
  const newItem = {
    ...item,
    id: item.id || `scoop-${Date.now()}`,
    isAvailable: item.isAvailable !== false,
  };
  const updated = [newItem, ...current];
  saveAllGelatoFlavours(updated);

  pushItem(newItem, 'scoop');

  return newItem;
}

export function updateScoopItem(id: string, updates: Partial<ScoopItem>): ScoopItem | null {
  const current = getAllGelatoFlavours();
  const idx = current.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const updatedItem = { ...current[idx], ...updates };
  current[idx] = updatedItem;
  saveAllGelatoFlavours(current);

  pushItem(updatedItem, 'scoop');

  return updatedItem;
}

export function deleteScoopItem(id: string): boolean {
  const current = getAllGelatoFlavours();
  const filtered = current.filter((i) => i.id !== id);
  if (filtered.length === current.length) return false;

  saveAllGelatoFlavours(filtered);

  pushDelete(id);

  return true;
}

// ----------------------------------------------------
// COFFEE ITEMS CRUD
// ----------------------------------------------------

export function getAllCoffeeItems(): MenuItem[] {
  try {
    const raw = localStorage.getItem(COFFEE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(COFFEE_STORAGE_KEY, JSON.stringify(SPECIALTY_COFFEE_ITEMS));
      return SPECIALTY_COFFEE_ITEMS;
    }
    const parsed: MenuItem[] = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(withCurrentImage) : SPECIALTY_COFFEE_ITEMS;
  } catch (err) {
    console.error('Failed to load coffee items:', err);
    return SPECIALTY_COFFEE_ITEMS;
  }
}

export function saveAllCoffeeItems(items: MenuItem[]): void {
  try {
    localStorage.setItem(COFFEE_STORAGE_KEY, JSON.stringify(items));
    notifyMenuUpdated();
  } catch (err) {
    console.error('Failed to save coffee items:', err);
  }
}

export function createCoffeeItem(item: MenuItem): MenuItem {
  const current = getAllCoffeeItems();
  const newItem = {
    ...item,
    id: item.id || `coffee-${Date.now()}`,
    category: 'coffee' as const,
    isAvailable: item.isAvailable !== false,
  };
  const updated = [newItem, ...current];
  saveAllCoffeeItems(updated);

  pushItem(newItem, 'coffee');

  return newItem;
}

export function updateCoffeeItem(id: string, updates: Partial<MenuItem>): MenuItem | null {
  const current = getAllCoffeeItems();
  const idx = current.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const updatedItem = { ...current[idx], ...updates };
  current[idx] = updatedItem;
  saveAllCoffeeItems(current);

  pushItem(updatedItem, 'coffee');

  return updatedItem;
}

export function deleteCoffeeItem(id: string): boolean {
  const current = getAllCoffeeItems();
  const filtered = current.filter((i) => i.id !== id);
  if (filtered.length === current.length) return false;

  saveAllCoffeeItems(filtered);

  pushDelete(id);

  return true;
}

// ----------------------------------------------------
// CAKES ITEMS CRUD
// ----------------------------------------------------

export function getAllCakeItems(): MenuItem[] {
  try {
    const raw = localStorage.getItem(CAKES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CAKES_STORAGE_KEY, JSON.stringify(ARTISAN_CAKES_ITEMS));
      return ARTISAN_CAKES_ITEMS;
    }
    const parsed: MenuItem[] = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(withCurrentImage) : ARTISAN_CAKES_ITEMS;
  } catch (err) {
    console.error('Failed to load cake items:', err);
    return ARTISAN_CAKES_ITEMS;
  }
}

export function saveAllCakeItems(items: MenuItem[]): void {
  try {
    localStorage.setItem(CAKES_STORAGE_KEY, JSON.stringify(items));
    notifyMenuUpdated();
  } catch (err) {
    console.error('Failed to save cakes:', err);
  }
}

export function createCakeItem(item: MenuItem): MenuItem {
  const current = getAllCakeItems();
  const newItem = {
    ...item,
    id: item.id || `cake-${Date.now()}`,
    category: 'cakes' as const,
    isAvailable: item.isAvailable !== false,
  };
  const updated = [newItem, ...current];
  saveAllCakeItems(updated);

  pushItem(newItem, 'cake');

  return newItem;
}

export function updateCakeItem(id: string, updates: Partial<MenuItem>): MenuItem | null {
  const current = getAllCakeItems();
  const idx = current.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const updatedItem = { ...current[idx], ...updates };
  current[idx] = updatedItem;
  saveAllCakeItems(current);

  pushItem(updatedItem, 'cake');

  return updatedItem;
}

export function deleteCakeItem(id: string): boolean {
  const current = getAllCakeItems();
  const filtered = current.filter((i) => i.id !== id);
  if (filtered.length === current.length) return false;

  saveAllCakeItems(filtered);

  pushDelete(id);

  return true;
}

// ----------------------------------------------------
// QUICK TOGGLE IN-STOCK / SOLD-OUT
// ----------------------------------------------------

export function toggleItemStockStatus(itemId: string, itemType: 'scoops' | 'coffee' | 'cakes'): boolean {
  if (itemType === 'scoops') {
    const scoops = getAllGelatoFlavours();
    const item = scoops.find((s) => s.id === itemId);
    if (!item) return false;
    const nextStatus = item.isAvailable === false ? true : false;
    updateScoopItem(itemId, { isAvailable: nextStatus });
    return nextStatus;
  } else if (itemType === 'coffee') {
    const coffee = getAllCoffeeItems();
    const item = coffee.find((c) => c.id === itemId);
    if (!item) return false;
    const nextStatus = item.isAvailable === false ? true : false;
    updateCoffeeItem(itemId, { isAvailable: nextStatus });
    return nextStatus;
  } else {
    const cakes = getAllCakeItems();
    const item = cakes.find((c) => c.id === itemId);
    if (!item) return false;
    const nextStatus = item.isAvailable === false ? true : false;
    updateCakeItem(itemId, { isAvailable: nextStatus });
    return nextStatus;
  }
}

// ----------------------------------------------------
// RESET TO ARTISANAL DEFAULTS
// ----------------------------------------------------

export function resetMenuToDefaults(): void {
  try {
    localStorage.setItem(SCOOPS_STORAGE_KEY, JSON.stringify(ALL_20_FLAVOURS));
    localStorage.setItem(COFFEE_STORAGE_KEY, JSON.stringify(SPECIALTY_COFFEE_ITEMS));
    localStorage.setItem(CAKES_STORAGE_KEY, JSON.stringify(ARTISAN_CAKES_ITEMS));
    notifyMenuUpdated();
  } catch (err) {
    console.error('Failed to reset menu to defaults:', err);
  }
}

// ----------------------------------------------------
// SERVER SYNC FOR MENU
// ----------------------------------------------------

/**
 * Merge the admin's menu changes from the server into the local menu
 * (items with changes of ours still on their way are left as they are on screen).
 */
export function mergeServerMenuItems(items: any[]): void {
  if (!items || items.length === 0) return;

  const pending = pendingWritePaths();
  const currentScoops = [...getAllGelatoFlavours()];
  const currentCoffee = [...getAllCoffeeItems()];
  const currentCakes = [...getAllCakeItems()];

  let hasScoopChanges = false;
  let hasCoffeeChanges = false;
  let hasCakeChanges = false;

  items.forEach((raw) => {
    if (!raw?.id || pending.has(menuPath(raw.id))) return;
    const { updatedAt: _updatedAt, ...item } = raw;

    // Deleted on the server: remove it here too
    if (item.isDeleted) {
      const sIdx = currentScoops.findIndex((s) => s.id === item.id);
      if (sIdx > -1) {
        currentScoops.splice(sIdx, 1);
        hasScoopChanges = true;
      }
      const cIdx = currentCoffee.findIndex((c) => c.id === item.id);
      if (cIdx > -1) {
        currentCoffee.splice(cIdx, 1);
        hasCoffeeChanges = true;
      }
      const kIdx = currentCakes.findIndex((c) => c.id === item.id);
      if (kIdx > -1) {
        currentCakes.splice(kIdx, 1);
        hasCakeChanges = true;
      }
      return;
    }

    const type = item.itemType || (item.tastingNotes ? 'scoop' : item.category === 'coffee' ? 'coffee' : 'cake');
    const list: any[] = type === 'scoop' ? currentScoops : type === 'coffee' ? currentCoffee : currentCakes;
    const idx = list.findIndex((x) => x.id === item.id);
    const merged = idx > -1 ? { ...list[idx], ...item } : item;
    if (idx > -1 && JSON.stringify(merged) === JSON.stringify(list[idx])) return;
    if (idx > -1) list[idx] = merged;
    else list.unshift(merged);
    if (type === 'scoop') hasScoopChanges = true;
    else if (type === 'coffee') hasCoffeeChanges = true;
    else hasCakeChanges = true;
  });

  if (hasScoopChanges) {
    localStorage.setItem(SCOOPS_STORAGE_KEY, JSON.stringify(currentScoops));
  }
  if (hasCoffeeChanges) {
    localStorage.setItem(COFFEE_STORAGE_KEY, JSON.stringify(currentCoffee));
  }
  if (hasCakeChanges) {
    localStorage.setItem(CAKES_STORAGE_KEY, JSON.stringify(currentCakes));
  }

  if (hasScoopChanges || hasCoffeeChanges || hasCakeChanges) {
    notifyMenuUpdated();
  }
}

/**
 * Fetch the admin's menu changes from the server. Several parts of the page ask for this at
 * once on load, so they share one request.
 */
let menuRequest: Promise<void> | null = null;
export function syncMenuFromServer(): Promise<void> {
  menuRequest ??= api<{ items: any[] }>('/menu', { as: 'none' })
    .then(({ items }) => mergeServerMenuItems(items))
    .catch((err) => console.warn('Could not load menu changes:', err))
    .finally(() => {
      menuRequest = null;
    });
  return menuRequest;
}

const menuPoller = sharedPoller(() => startPolling(syncMenuFromServer, { visibleMs: 60_000 }));

/**
 * Keep the menu up to date while the page is open (e.g. an item marked sold out in the
 * console). `callback` runs after each check; screens also listen for MENU_UPDATED_EVENT.
 */
export function subscribeToRealtimeMenu(callback?: () => void): () => void {
  const stop = menuPoller();
  if (!callback) return stop;
  window.addEventListener(MENU_UPDATED_EVENT, callback);
  return () => {
    window.removeEventListener(MENU_UPDATED_EVENT, callback);
    stop();
  };
}
