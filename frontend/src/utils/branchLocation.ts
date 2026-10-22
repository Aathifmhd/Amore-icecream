import { BranchId } from '../types';

/** Where each parlour is on the map */
export const BRANCH_COORDS: Record<BranchId, { lat: number; lng: number }> = {
  akurana: { lat: 7.3639, lng: 80.6175 },
  colombo: { lat: 6.9061, lng: 79.8507 },
  arugambay: { lat: 6.8427, lng: 81.8344 },
};

/** The parlour closest to a delivery pin (straight-line distance is enough at this scale) */
export function nearestBranch(coords: { lat: number; lng: number }): BranchId {
  let best: BranchId = 'akurana';
  let bestDistance = Infinity;
  for (const [id, c] of Object.entries(BRANCH_COORDS) as [BranchId, { lat: number; lng: number }][]) {
    const d = Math.hypot(coords.lat - c.lat, coords.lng - c.lng);
    if (d < bestDistance) {
      best = id;
      bestDistance = d;
    }
  }
  return best;
}
