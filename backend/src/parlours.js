import { col, getSetting } from './db.js';

/*
 * Where each parlour is on the map and how far it delivers (km). The super admin sets these in
 * the console (Settings → Locations & delivery); until then the defaults below apply.
 * The website keeps the same defaults for before it has heard from here
 * (frontend/src/utils/branchLocation.ts).
 */
export const DEFAULT_PARLOURS = {
  akurana: { lat: 7.3639, lng: 80.6175, radiusKm: 6 },
  colombo: { lat: 6.909, lng: 79.8478, radiusKm: 6 },
  arugambay: { lat: 6.84, lng: 81.836, radiusKm: 6 },
};
const KEY = 'parlour_locations';

/** Every parlour's location and delivery range (saved values over the defaults). */
export async function getParlours() {
  const saved = (await getSetting(KEY)) || {};
  return Object.fromEntries(Object.entries(DEFAULT_PARLOURS).map(([id, d]) => [id, { ...d, ...(saved[id] || {}) }]));
}

/** Save one parlour (only that one, so two admins saving different parlours don't clash). */
export async function saveParlour(id, value) {
  await col('settings').updateOne({ key: KEY }, { $set: { key: KEY, [`value.${id}`]: value } }, { upsert: true });
}

/** Distance over the earth's surface, in km */
export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
