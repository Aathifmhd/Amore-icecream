/**
 * Admin access for the Amore operations console (/admin).
 *
 * Admins sign in with a name + password kept on the backend (MongoDB), or — for the owner —
 * with Google. The backend then hands out a session (see api.ts).
 *
 * User code: after signing in on a device, an admin can set a 4–6 digit code. The backend
 * remembers the device and checks the code (with a limit on wrong tries), so next time the
 * console opens with just the code. On such a device the session lasts only until the
 * browser closes or the admin presses "Lock".
 */
import { useEffect, useState } from 'react';
import {
  api,
  ApiError,
  ADMIN_SESSION_EVENT,
  clearAdminSession,
  getAdminSession,
  saveAdminSession,
  type AdminProfile,
  type AdminSession,
} from '../api';

const DEVICE_KEY = 'amore_admin_device_v1'; // localStorage: this device's id + secret
const OFFER_KEY = 'amore_admin_offer_code_v1'; // sessionStorage: offer to set a code after signing in

interface RememberedDevice {
  deviceId: string;
  deviceSecret: string;
  displayName: string;
}

const store = {
  get: (s: Storage, k: string) => {
    try {
      return s.getItem(k);
    } catch {
      return null;
    }
  },
  set: (s: Storage, k: string, v: string) => {
    try {
      s.setItem(k, v);
    } catch {
      /* storage blocked */
    }
  },
  del: (s: Storage, k: string) => {
    try {
      s.removeItem(k);
    } catch {
      /* storage blocked */
    }
  },
};

export function getRememberedDevice(): RememberedDevice | null {
  try {
    const d = JSON.parse(store.get(localStorage, DEVICE_KEY) || 'null') as RememberedDevice | null;
    return d?.deviceId && d.deviceSecret ? d : null;
  } catch {
    return null;
  }
}

const forgetDeviceLocally = () => store.del(localStorage, DEVICE_KEY);
const notify = () => window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EVENT));

export const isValidCodeFormat = (code: string) => /^\d{4,6}$/.test(code);

/** True when an admin session is open in this browser (used to show the console link). */
export const hasAdminSession = () => Boolean(getAdminSession());

function startSession(session: AdminSession) {
  // With a user code on this device, the session ends with the browser; otherwise it is kept
  saveAdminSession(session, Boolean(getRememberedDevice()));
}

// ---- Sign in -----------------------------------------------------------------

export async function signInWithPassword(username: string, password: string): Promise<void> {
  const session = await api<AdminSession>('/admin/login', { method: 'POST', body: { username, password }, as: 'none' });
  if (!getRememberedDevice()) store.set(sessionStorage, OFFER_KEY, '1');
  startSession(session);
}

/** Owner sign-in: `credential` comes from Google's "Sign in with Google" button. */
export async function signInOwnerWithGoogle(credential: string): Promise<void> {
  const session = await api<AdminSession>('/admin/google', { method: 'POST', body: { credential }, as: 'none' });
  if (!getRememberedDevice()) store.set(sessionStorage, OFFER_KEY, '1');
  startSession(session);
}

/** Unlock with this device's user code. 'forgotten' = the device must sign in with name + password again. */
export async function unlockWithCode(code: string): Promise<{ result: 'ok' | 'wrong' | 'forgotten'; triesLeft: number; message?: string }> {
  const device = getRememberedDevice();
  if (!device) return { result: 'forgotten', triesLeft: 0 };
  try {
    const session = await api<AdminSession>('/admin/device/unlock', {
      method: 'POST',
      body: { deviceId: device.deviceId, deviceSecret: device.deviceSecret, code },
      as: 'none',
    });
    saveAdminSession(session, true);
    return { result: 'ok', triesLeft: 0 };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { result: 'wrong', triesLeft: err.data.triesLeft ?? 0 };
    if (err instanceof ApiError && err.status === 410) {
      forgetDeviceLocally();
      notify();
      return { result: 'forgotten', triesLeft: 0, message: err.message };
    }
    throw err;
  }
}

/** Remember this device with a user code (needs an open session). */
export async function setUserCode(code: string): Promise<void> {
  const session = getAdminSession();
  if (!session) throw new ApiError(401, 'Please sign in again');
  const old = getRememberedDevice();
  const { deviceId, deviceSecret } = await api<{ deviceId: string; deviceSecret: string }>('/admin/device', {
    method: 'POST',
    body: { code },
    as: 'admin',
  });
  if (old) api('/admin/device/forget', { method: 'POST', body: old, as: 'none' }).catch(() => {});
  store.set(localStorage, DEVICE_KEY, JSON.stringify({ deviceId, deviceSecret, displayName: session.admin.displayName }));
  store.del(sessionStorage, OFFER_KEY);
  // From now on the session on this device ends with the browser (the code opens it again)
  saveAdminSession(session, true);
}

export function skipUserCode(): void {
  store.del(sessionStorage, OFFER_KEY);
  notify();
}

/** Lock the console: the code (or name + password) is needed to open it again. */
export function lockConsole(): void {
  clearAdminSession();
}

/** Sign out and stop remembering this device. */
export async function forgetThisDevice(): Promise<void> {
  const device = getRememberedDevice();
  forgetDeviceLocally();
  clearAdminSession();
  if (device) await api('/admin/device/forget', { method: 'POST', body: device, as: 'none' }).catch(() => {});
}

export function signOutAdmin(): void {
  store.del(sessionStorage, OFFER_KEY);
  clearAdminSession();
}

// ---- What /admin shows ---------------------------------------------------------

export type AdminGate = 'checking' | 'signed-out' | 'needs-code' | 'offer-code' | 'open';

function gateNow(checked: boolean): AdminGate {
  const session = getAdminSession();
  if (session) {
    if (!checked) return 'checking';
    return store.get(sessionStorage, OFFER_KEY) && !getRememberedDevice() ? 'offer-code' : 'open';
  }
  return getRememberedDevice() ? 'needs-code' : 'signed-out';
}

/**
 * The /admin page's state. A session found in storage is checked with the server once
 * (it may have expired, or the password may have changed) before the console opens.
 */
export function useAdminGate(): { gate: AdminGate; admin: AdminProfile | null; deviceName: string | null } {
  const [checked, setChecked] = useState(false);
  const [, setVersion] = useState(0);

  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener(ADMIN_SESSION_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(ADMIN_SESSION_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  useEffect(() => {
    if (!getAdminSession()) {
      setChecked(true);
      return;
    }
    api('/admin/me', { as: 'admin' })
      .catch((err) => {
        // Offline: let the console open on what this device has; it catches up when back online
        if (!(err instanceof ApiError) || err.status !== 0) clearAdminSession();
      })
      .finally(() => setChecked(true));
  }, []);

  return {
    gate: gateNow(checked),
    admin: getAdminSession()?.admin ?? null,
    deviceName: getRememberedDevice()?.displayName ?? null,
  };
}
