/**
 * The rider app's data: sign-in, the orders a rider works with, and the three actions
 * (pick up, delivered, hand back). The server checks every step (backend/src/routes/rider.js).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, getRiderSession, saveRiderSession, type RiderProfile, type RiderSession } from '../api';
import type { PaidVia } from '../types';
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
  /** Card orders: the card's brand (paid online at checkout) */
  cardBrand: string | null;
  collectCash: boolean;
  branchId: RiderProfile['branchId'];
  onTheWayAt: string | null;
  deliveredAt: string | null;
  cashCollectedLKR: number | null;
  /** How it was paid in the end, and whether the rider or the parlour marked it delivered */
  paidVia: PaidVia | null;
  deliveredBy: 'rider' | 'parlour' | null;
  /** The customer's stars for this delivery (their comment is for the parlour only) */
  riderRating: number | null;
  riderNote: string | null;
}

/** Cash from cash-on-delivery orders: what the rider holds now and what they handed in */
export interface RiderCash {
  holdingLKR: number;
  collectedTodayLKR: number;
  handedInTodayLKR: number;
  lastHandIn: { amountLKR: number; receivedAt: string; receivedBy: string } | null;
  /** Cash still held from deliveries before today, by day ("2026-10-22"), oldest first */
  earlier: { day: string; amountLKR: number; deliveries: number }[];
}

export interface RatingSummary {
  average: number | null;
  count: number;
}

export interface RiderRatings extends RatingSummary {
  deliveries: { total: number; thisMonth: number };
  breakdown: Record<string, number>;
  recent: { orderReference: string; customerFirstName: string; rating: number; ratedAt: string }[];
}

export interface RiderBoard {
  rider: RiderProfile;
  ready: RiderOrder[];
  mine: RiderOrder[];
  done: RiderOrder[];
  upcoming: number;
  cash: RiderCash;
  rating: RatingSummary;
  /** The day the Done list is for ("2026-10-23", Sri Lanka); it starts fresh every day */
  day: string;
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

export const loadRatings = () => api<RiderRatings>('/rider/ratings', { as: 'rider' });
/** The rider's photo (set by the parlour), or null */
export const loadMyPhoto = () => api<{ photo: string | null }>('/rider/photo', { as: 'rider' }).then((r) => r.photo);

/** The rider's board, kept fresh (every few seconds while the app is open). `nextDay`: the demo of tomorrow. */
export function useRiderBoard(onSignedOut: () => void, nextDay = false) {
  const [board, setBoard] = useState<RiderBoard | null>(null);
  const [offline, setOffline] = useState(false);
  const signedOut = useRef(onSignedOut);
  signedOut.current = onSignedOut;

  const load = useCallback(async () => {
    if (!getRiderSession()) return signedOut.current();
    try {
      const next = await api<RiderBoard>(`/rider/orders${nextDay ? '?day=next' : ''}`, { as: 'rider' });
      setBoard(next);
      setOffline(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        riderSignOut();
        signedOut.current();
      } else setOffline(true);
    }
  }, [nextDay]);

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
/** "6:30 PM" today, otherwise "12 Oct" */
export const dayOrClock = (iso: string | null) =>
  !iso ? '' : new Date(iso).toDateString() === new Date().toDateString() ? clock(iso) : new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
export const shortRef = (ref: string) => '#' + ref.replace(/^AMO-(M)?/, (_, m) => m || '');
