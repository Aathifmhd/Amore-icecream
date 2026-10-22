/**
 * Admin access for the Amore operations console (/admin).
 *
 * Who is an admin is decided by Firebase Authentication + the Firestore/Storage
 * rules (see isAdmin() there). This module mirrors that for the UI and adds a
 * per-device "user code": after a name + password sign-in on a device, an admin
 * can set a short code that unlocks the console on that device next time.
 *
 * The code is a convenience lock on an already signed-in device, not a password:
 * it is stored only as a salted PBKDF2 hash, and too many wrong tries sign the
 * device out so the full name + password is needed again.
 */
import { ADMIN_ACCOUNTS, ADMIN_EMAILS } from '../config';
import type { User } from '../firebase';

const PASSWORD_ADMIN_EMAILS = Object.values(ADMIN_ACCOUNTS).map((e) => e.toLowerCase());

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user || !user.email) return false;
  const email = user.email.toLowerCase();
  const viaGoogle = user.emailVerified && ADMIN_EMAILS.includes(email);
  const viaPassword =
    PASSWORD_ADMIN_EMAILS.includes(email) && user.providerData.some((p) => p.providerId === 'password');
  return viaGoogle || viaPassword;
}

/** "Admin" → the Firebase account email for that sign-in name, or null if unknown. */
export function adminEmailForName(name: string): string | null {
  return ADMIN_ACCOUNTS[name.trim().toLowerCase()] ?? null;
}

// ---- Per-device user code ------------------------------------------------

const CODE_KEY = 'amore_admin_quick_code_v1';
const ATTEMPTS_KEY = 'amore_admin_code_attempts_v1';
const UNLOCKED_KEY = 'amore_admin_unlocked_v1'; // sessionStorage: uid unlocked this browser session
const OFFER_KEY = 'amore_admin_offer_code_v1'; // sessionStorage: offer to set a code after password sign-in
const PENDING_KEY = 'amore_admin_pw_pending_v1'; // sessionStorage: password sign-in in progress
export const MAX_CODE_ATTEMPTS = 5;
const PBKDF2_ITERATIONS = 150_000;

interface StoredCode {
  uid: string;
  salt: string;
  hash: string;
}

const store = {
  get: (s: Storage, k: string) => {
    try { return s.getItem(k); } catch { return null; }
  },
  set: (s: Storage, k: string, v: string) => {
    try { s.setItem(k, v); } catch { /* storage blocked */ }
  },
  del: (s: Storage, k: string) => {
    try { s.removeItem(k); } catch { /* storage blocked */ }
  },
};

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashCode(code: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return toB64(bits);
}

function readCode(): StoredCode | null {
  try {
    const raw = store.get(localStorage, CODE_KEY);
    return raw ? (JSON.parse(raw) as StoredCode) : null;
  } catch {
    return null;
  }
}

export function hasUserCode(uid: string): boolean {
  return readCode()?.uid === uid;
}

export const isValidCodeFormat = (code: string) => /^\d{4,6}$/.test(code);

export async function setUserCode(uid: string, code: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashCode(code, salt);
  store.set(localStorage, CODE_KEY, JSON.stringify({ uid, salt: toB64(salt), hash }));
  store.del(localStorage, ATTEMPTS_KEY);
}

/** Checks a code; returns 'ok', 'wrong' (with tries left) or 'locked' after too many misses. */
export async function checkUserCode(uid: string, code: string): Promise<{ result: 'ok' | 'wrong' | 'locked'; triesLeft: number }> {
  const stored = readCode();
  if (!stored || stored.uid !== uid) return { result: 'locked', triesLeft: 0 };
  const hash = await hashCode(code, fromB64(stored.salt));
  if (hash === stored.hash) {
    store.del(localStorage, ATTEMPTS_KEY);
    return { result: 'ok', triesLeft: MAX_CODE_ATTEMPTS };
  }
  const attempts = Number(store.get(localStorage, ATTEMPTS_KEY) || '0') + 1;
  if (attempts >= MAX_CODE_ATTEMPTS) {
    clearUserCode();
    return { result: 'locked', triesLeft: 0 };
  }
  store.set(localStorage, ATTEMPTS_KEY, String(attempts));
  return { result: 'wrong', triesLeft: MAX_CODE_ATTEMPTS - attempts };
}

export function clearUserCode(): void {
  store.del(localStorage, CODE_KEY);
  store.del(localStorage, ATTEMPTS_KEY);
}

// ---- Session gate --------------------------------------------------------

export const markUnlocked = (uid: string) => store.set(sessionStorage, UNLOCKED_KEY, uid);
export const lockConsole = () => store.del(sessionStorage, UNLOCKED_KEY);
export const setOfferCode = (on: boolean) => (on ? store.set(sessionStorage, OFFER_KEY, '1') : store.del(sessionStorage, OFFER_KEY));
export const setPasswordPending = (on: boolean) =>
  on ? store.set(sessionStorage, PENDING_KEY, String(Date.now())) : store.del(sessionStorage, PENDING_KEY);

export type AdminGate = 'signed-out' | 'pending' | 'needs-code' | 'offer-code' | 'open';

/** What the /admin page should show for this user right now. */
export function getAdminGate(user: User | null): AdminGate {
  // A sign-in that never finished (e.g. page reloaded mid-way) stops counting after 20s
  if (Date.now() - Number(store.get(sessionStorage, PENDING_KEY) || 0) < 20_000) return 'pending';
  if (!user || !isAdminUser(user)) return 'signed-out';
  if (hasUserCode(user.uid)) {
    return store.get(sessionStorage, UNLOCKED_KEY) === user.uid ? 'open' : 'needs-code';
  }
  return store.get(sessionStorage, OFFER_KEY) ? 'offer-code' : 'open';
}
