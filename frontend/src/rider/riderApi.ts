/**
 * The rider app's data: sign-in, the orders a rider works with, and the three actions
 * (pick up, delivered, hand back). The server checks every step (backend/src/routes/rider.js).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, getRiderSession, saveRiderSession, type RiderProfile, type RiderSession } from '../api';
import { startPolling } from '../utils/poll';

export interface RiderOrder {
  orderReference: string;
  createdAt: string;
  readyAt: string | null;
  status: 'preparing' | 'on_the_way' | 'delivered';
  customerName: string;
  contactNumber: string;
  deliveryAddress: string;
  city: string;
  deliveryCoordinates: { lat: number; lng: number } | null;
  specialNote: string;
  items: { name: string; format: string | null; quantity: number }[];
  grandTotalLKR: number;
  paymentMethod: string;
  collectCash: boolean;
  branchId: RiderProfile['branchId'];
  onTheWayAt: string | null;
  deliveredAt: string | null;
  cashCollectedLKR: number | null;
  riderNote: string | null;
}

export interface RiderBoard {
  rider: RiderProfile;
  ready: RiderOrder[];
  mine: RiderOrder[];
  done: RiderOrder[];
  upcoming: number;
}

export async function riderSignIn(phone: string, pin: string): Promise<RiderSession> {
  const session = await api<RiderSession>('/rider/login', { method: 'POST', body: { phone, pin }, as: 'none' });
  saveRiderSession(session);
  return session;
}

export const riderSignOut = () => saveRiderSession(null);

export const pickUp = (ref: string) => api<{ order: RiderOrder }>(`/rider/orders/${encodeURIComponent(ref)}/pickup`, { method: 'POST', as: 'rider' });
export const markDelivered = (ref: string, cashCollected: boolean) =>
  api<{ order: RiderOrder }>(`/rider/orders/${encodeURIComponent(ref)}/delivered`, { method: 'POST', body: { cashCollected }, as: 'rider' });
export const handBack = (ref: string, reason: string) =>
  api<{ order: RiderOrder }>(`/rider/orders/${encodeURIComponent(ref)}/hand-back`, { method: 'POST', body: { reason }, as: 'rider' });

/** The rider's board, kept fresh (every few seconds while the app is open). */
export function useRiderBoard(onSignedOut: () => void) {
  const [board, setBoard] = useState<RiderBoard | null>(null);
  const [offline, setOffline] = useState(false);
  const signedOut = useRef(onSignedOut);
  signedOut.current = onSignedOut;

  const load = useCallback(async () => {
    if (!getRiderSession()) return signedOut.current();
    try {
      const next = await api<RiderBoard>('/rider/orders', { as: 'rider' });
      setBoard(next);
      setOffline(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        riderSignOut();
        signedOut.current();
      } else setOffline(true);
    }
  }, []);

  useEffect(() => startPolling(load, { visibleMs: 8000, hiddenMs: 30000 }), [load]);
  return { board, offline, reload: load };
}

let audio: AudioContext | null = null;
/** A short two-note chime (and a buzz on phones) when a new order is ready */
export function alertNewOrder() {
  try {
    navigator.vibrate?.([120, 80, 120]);
  } catch {
    /* no vibration */
  }
  try {
    audio = audio || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [880, 1318.5].forEach((freq, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.frequency.value = freq;
      const t = audio!.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(audio!.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    /* no sound */
  }
}

/** Google Maps directions to the customer (opens the Maps app on phones) */
export const directionsUrl = (o: RiderOrder) =>
  o.deliveryCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${o.deliveryCoordinates.lat},${o.deliveryCoordinates.lng}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.deliveryAddress}, ${o.city}, Sri Lanka`)}`;

/** WhatsApp link for a Sri Lankan number ("077…" → "9477…") */
export const whatsappUrl = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.startsWith('0') ? `94${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
};

export const minutesSince = (iso: string | null, now = Date.now()) => (iso ? Math.max(0, Math.round((now - Date.parse(iso)) / 60000)) : 0);
export const agoText = (iso: string | null, now = Date.now()) => {
  const m = minutesSince(iso, now);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ${m % 60} min ago`;
};
export const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
export const shortRef = (ref: string) => '#' + ref.replace(/^AMO-(M)?/, (_, m) => m || '');
