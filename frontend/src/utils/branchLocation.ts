import { useEffect, useSyncExternalStore } from 'react';
import { BranchId } from '../types';
import { api } from '../api';

/**
 * Where each parlour is on the map and how far it delivers (km). The super admin sets these in
 * the console (Settings → Locations & delivery) and the backend checks orders against them
 * (backend/src/parlours.js). These defaults are only used until the website has heard from it.
 */
export interface ParlourZone {
  lat: number;
  lng: number;
  radiusKm: number;
}
export type ParlourZones = Record<BranchId, ParlourZone>;

export const DEFAULT_PARLOURS: ParlourZones = {
  akurana: { lat: 7.3639, lng: 80.6175, radiusKm: 6 },
  colombo: { lat: 6.909, lng: 79.8478, radiusKm: 6 },
  arugambay: { lat: 6.84, lng: 81.836, radiusKm: 6 },
};

const CACHE_KEY = 'amore_parlours_v1';
const SHORT: Record<BranchId, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };

function readCache(): ParlourZones {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as Partial<ParlourZones> | null;
    return saved ? { ...DEFAULT_PARLOURS, ...saved } : DEFAULT_PARLOURS;
  } catch {
    return DEFAULT_PARLOURS;
  }
}

let zones: ParlourZones = typeof window === 'undefined' ? DEFAULT_PARLOURS : readCache();
const listeners = new Set<() => void>();
let fetched = false;

/** Ask the server for the latest locations and ranges (and tell every map and checkout). */
export async function refreshParlourZones(): Promise<ParlourZones> {
  fetched = true;
  try {
    const { parlours } = await api<{ parlours: ParlourZones }>('/parlours');
    const next = { ...DEFAULT_PARLOURS };
    for (const id of Object.keys(next) as BranchId[]) {
      const p = parlours?.[id];
      if (p) next[id] = { lat: p.lat, lng: p.lng, radiusKm: p.radiusKm };
    }
    zones = next;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(zones));
    } catch {
      /* storage blocked */
    }
    listeners.forEach((l) => l());
  } catch {
    // Offline: keep what we have
  }
  return zones;
}

/** The parlours' locations and ranges; fetched once per visit, then kept up to date. */
export function useParlourZones(): ParlourZones {
  useEffect(() => {
    if (!fetched) refreshParlourZones();
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => zones
  );
}

type Coords = { lat: number; lng: number };

/** Distance over the earth's surface, in km */
export function distanceKm(a: Coords, b: Coords): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Can this pin get a delivery? Measured from `from` when the parlour is already fixed
 * (editing a placed order), otherwise from the nearest parlour.
 */
export function deliveryCheck(
  coords: Coords,
  from?: BranchId,
  all: ParlourZones = zones
): { branch: BranchId; km: number; radiusKm: number; ok: boolean } {
  const ids = from ? [from] : (Object.keys(all) as BranchId[]);
  let branch = ids[0];
  let km = Infinity;
  for (const id of ids) {
    const d = distanceKm(coords, all[id]);
    if (d < km) {
      branch = id;
      km = d;
    }
  }
  const radiusKm = all[branch].radiusKm;
  return { branch, km, radiusKm, ok: km <= radiusKm };
}

/** The parlour closest to a delivery pin */
export function nearestBranch(coords: Coords, all: ParlourZones = zones): BranchId {
  return deliveryCheck(coords, undefined, all).branch;
}

/** "within 6 km of our parlours in Akurana, Colombo and Arugam Bay" (or each one's range) */
export function deliveryRangeText(all: ParlourZones = zones): string {
  const ids = Object.keys(all) as BranchId[];
  const radii = ids.map((id) => all[id].radiusKm);
  if (radii.every((r) => r === radii[0])) {
    return `within ${radii[0]} km of our parlours in ${ids.slice(0, -1).map((id) => SHORT[id]).join(', ')} and ${SHORT[ids[ids.length - 1]]}`;
  }
  return `near our parlours: ${ids.map((id) => `${SHORT[id]} ${all[id].radiusKm} km`).join(', ')}`;
}
