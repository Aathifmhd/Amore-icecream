/**
 * Live data for the operations console: every order (kept up to date from the
 * server, cached locally) and the menu, plus small shared hooks.
 */
import { useEffect, useRef, useState } from 'react';
import { BranchId, MenuItem, OrderRecord, ScoopItem } from '../../../types';
import { getAllOrdersAdmin, ORDERS_UPDATED_EVENT, watchAllOrders } from '../../../utils/orderStorage';
import {
  getAllCakeItems,
  getAllCoffeeItems,
  getAllGelatoFlavours,
  MENU_UPDATED_EVENT,
  subscribeToRealtimeMenu,
  syncMenuFromServer,
} from '../../../utils/menuStorage';
import { OUTBOX_EVENT, pendingWrites } from '../../../utils/outbox';
import { startPolling } from '../../../utils/poll';

export function useOrders(): OrderRecord[] {
  const [orders, setOrders] = useState<OrderRecord[]>(() => getAllOrdersAdmin());

  useEffect(() => {
    const reload = () => setOrders(getAllOrdersAdmin());
    const unsubscribe = watchAllOrders();
    window.addEventListener(ORDERS_UPDATED_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      unsubscribe();
      window.removeEventListener(ORDERS_UPDATED_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  return orders;
}

export interface MenuData {
  scoops: ScoopItem[];
  coffee: MenuItem[];
  cakes: MenuItem[];
}

export function useMenu(): MenuData {
  const read = (): MenuData => ({ scoops: getAllGelatoFlavours(), coffee: getAllCoffeeItems(), cakes: getAllCakeItems() });
  const [menu, setMenu] = useState<MenuData>(read);

  useEffect(() => {
    const reload = () => setMenu(read());
    const unsubscribe = subscribeToRealtimeMenu(reload);
    // The console checks more often than the website, so a branch's sold-out switch shows up quickly
    const stopFastSync = startPolling(syncMenuFromServer, { visibleMs: 15_000, hiddenMs: 60_000 });
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('amore_menu_')) reload();
    };
    window.addEventListener(MENU_UPDATED_EVENT, reload);
    window.addEventListener('storage', onStorage);
    return () => {
      unsubscribe();
      stopFastSync();
      window.removeEventListener(MENU_UPDATED_EVENT, reload);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return menu;
}

/**
 * How many changes made here haven't reached the server yet (e.g. while offline).
 * Stays 0 for the moment a change normally takes to send, so it only shows real delays.
 */
export function usePendingWrites(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let timer: number | undefined;
    const update = () => {
      window.clearTimeout(timer);
      if (pendingWrites() === 0) setCount(0);
      else timer = window.setTimeout(() => setCount(pendingWrites()), 2500);
    };
    update();
    window.addEventListener(OUTBOX_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(OUTBOX_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return count;
}

/** Current time, refreshed on an interval — only the components that show a clock re-render. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** A remembered per-device setting. */
export function useStoredState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage blocked */
    }
  };
  return [value, set];
}

export type BranchFilter = 'all' | BranchId;

export const inBranch = (o: OrderRecord, b: BranchFilter) => b === 'all' || (o.branchId || 'akurana') === b;

/**
 * Plays a short two-note chime when the number of new orders goes up
 * (not on first load), and shows the count in the browser tab title.
 */
export function useNewOrderAlert(newCount: number, soundOn: boolean) {
  const prev = useRef<number | null>(null);

  useEffect(() => {
    const base = 'Amore Operations';
    document.title = newCount > 0 ? `(${newCount}) New order${newCount === 1 ? '' : 's'} · ${base}` : base;
    return () => {
      document.title = 'Amore — Speciality Ice Cream, Coffee & Cakes';
    };
  }, [newCount]);

  useEffect(() => {
    if (prev.current !== null && newCount > prev.current && soundOn) chime();
    prev.current = newCount;
  }, [newCount, soundOn]);
}

let audioCtx: AudioContext | null = null;
export function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx!;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    /* audio unavailable */
  }
}
