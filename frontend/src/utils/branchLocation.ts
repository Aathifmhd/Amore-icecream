import { BranchId } from '../types';

/**
 * Where each parlour is on the map, and how far it delivers.
 * The backend checks the same (backend/src/orderRules.js): change both together.
 */
export const BRANCH_COORDS: Record<BranchId, { lat: number; lng: number }> = {
  akurana: { lat: 7.3639, lng: 80.6175 },
  colombo: { lat: 6.909, lng: 79.8478 },
  arugambay: { lat: 6.84, lng: 81.836 },
};
export const DELIVERY_RADIUS_KM = 6;

type Coords = { lat: number; lng: number };

/** Distance over the earth's surface, in km */
export function distanceKm(a: Coords, b: Coords): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The parlour closest to a delivery pin */
export function nearestBranch(coords: Coords): BranchId {
  return deliveryCheck(coords).branch;
}

/**
 * Can this pin get a delivery? Measured from `from` when the parlour is already fixed
 * (editing a placed order), otherwise from the nearest parlour.
 */
export function deliveryCheck(coords: Coords, from?: BranchId): { branch: BranchId; km: number; ok: boolean } {
  const ids = from ? [from] : (Object.keys(BRANCH_COORDS) as BranchId[]);
  let branch = ids[0];
  let km = Infinity;
  for (const id of ids) {
    const d = distanceKm(coords, BRANCH_COORDS[id]);
    if (d < km) {
      branch = id;
      km = d;
    }
  }
  return { branch, km, ok: km <= DELIVERY_RADIUS_KM };
}
