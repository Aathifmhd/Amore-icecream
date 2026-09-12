import { ScoopItem, MenuItem } from '../types';
import { ALL_20_FLAVOURS, SPECIALTY_COFFEE_ITEMS, ARTISAN_CAKES_ITEMS } from '../data/iceCreamData';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

const SCOOPS_STORAGE_KEY = 'amore_menu_scoops_v1';
const COFFEE_STORAGE_KEY = 'amore_menu_coffee_v1';
const CAKES_STORAGE_KEY = 'amore_menu_cakes_v1';

export const MENU_UPDATED_EVENT = 'amore_menu_updated';

function notifyMenuUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MENU_UPDATED_EVENT));
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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ALL_20_FLAVOURS;
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

  // Sync to Firestore
  try {
    setDoc(doc(db, 'menu_items', newItem.id), { ...newItem, itemType: 'scoop' }).catch(() => {});
  } catch {}

  return newItem;
}

export function updateScoopItem(id: string, updates: Partial<ScoopItem>): ScoopItem | null {
  const current = getAllGelatoFlavours();
  const idx = current.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const updatedItem = { ...current[idx], ...updates };
  current[idx] = updatedItem;
  saveAllGelatoFlavours(current);

  // Sync to Firestore
  try {
    setDoc(doc(db, 'menu_items', id), { ...updatedItem, itemType: 'scoop' }, { merge: true }).catch(() => {});
  } catch {}

  return updatedItem;
}

export function deleteScoopItem(id: string): boolean {
  const current = getAllGelatoFlavours();
  const filtered = current.filter((i) => i.id !== id);
  if (filtered.length === current.length) return false;

  saveAllGelatoFlavours(filtered);

  // Sync to Firestore
  try {
    deleteDoc(doc(db, 'menu_items', id)).catch(() => {});
  } catch {}

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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SPECIALTY_COFFEE_ITEMS;
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

  try {
    setDoc(doc(db, 'menu_items', newItem.id), { ...newItem, itemType: 'coffee' }).catch(() => {});
  } catch {}

  return newItem;
}

export function updateCoffeeItem(id: string, updates: Partial<MenuItem>): MenuItem | null {
  const current = getAllCoffeeItems();
  const idx = current.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const updatedItem = { ...current[idx], ...updates };
  current[idx] = updatedItem;
  saveAllCoffeeItems(current);

  try {
    setDoc(doc(db, 'menu_items', id), { ...updatedItem, itemType: 'coffee' }, { merge: true }).catch(() => {});
  } catch {}

  return updatedItem;
}

export function deleteCoffeeItem(id: string): boolean {
  const current = getAllCoffeeItems();
  const filtered = current.filter((i) => i.id !== id);
  if (filtered.length === current.length) return false;

  saveAllCoffeeItems(filtered);

  try {
    deleteDoc(doc(db, 'menu_items', id)).catch(() => {});
  } catch {}

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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ARTISAN_CAKES_ITEMS;
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

  try {
    setDoc(doc(db, 'menu_items', newItem.id), { ...newItem, itemType: 'cake' }).catch(() => {});
  } catch {}

  return newItem;
}

export function updateCakeItem(id: string, updates: Partial<MenuItem>): MenuItem | null {
  const current = getAllCakeItems();
  const idx = current.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const updatedItem = { ...current[idx], ...updates };
  current[idx] = updatedItem;
  saveAllCakeItems(current);

  try {
    setDoc(doc(db, 'menu_items', id), { ...updatedItem, itemType: 'cake' }, { merge: true }).catch(() => {});
  } catch {}

  return updatedItem;
}

export function deleteCakeItem(id: string): boolean {
  const current = getAllCakeItems();
  const filtered = current.filter((i) => i.id !== id);
  if (filtered.length === current.length) return false;

  saveAllCakeItems(filtered);

  try {
    deleteDoc(doc(db, 'menu_items', id)).catch(() => {});
  } catch {}

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

