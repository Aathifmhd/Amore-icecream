import type { BranchId } from './types';

/**
 * Talks to the Amore backend (/api — see backend/ in this repository).
 *
 * Customers and admins each get a session from the backend when they sign in (customers
 * with Google, admins at /admin). Each request sends the matching session.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, any> = {}
  ) {
    super(message);
  }
}

// ---- Admin session ---------------------------------------------------------

export type AdminRole = 'superadmin' | 'branch';
export interface AdminProfile {
  username: string;
  displayName: string;
  google: boolean;
  /** superadmin: everything, incl. admin logins. branch: one branch (branchId) only. */
  role: AdminRole;
  branchId: BranchId | null;
}
export interface AdminSession {
  token: string;
  expiresAt: string;
  admin: AdminProfile;
}

const SESSION_KEY = 'amore_admin_session_v1';
export const ADMIN_SESSION_EVENT = 'amore_admin_session_changed';

function readSession(storage: Storage, key = SESSION_KEY): AdminSession | CustomerSession | null {
  try {
    const s = JSON.parse(storage.getItem(key) || 'null') as AdminSession | CustomerSession | null;
    return s && s.token && Date.parse(s.expiresAt) > Date.now() ? s : null;
  } catch {
    return null;
  }
}

/** The admin session in this browser, if any (a code-protected device keeps it for this visit only). */
export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null;
  return (readSession(sessionStorage) || readSession(localStorage)) as AdminSession | null;
}

/** `thisVisitOnly`: forget it when the browser closes (used when the device has a user code). */
export function saveAdminSession(session: AdminSession, thisVisitOnly: boolean): void {
  clearAdminSession(false);
  try {
    (thisVisitOnly ? sessionStorage : localStorage).setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EVENT));
}

export function clearAdminSession(notify = true): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked */
  }
  if (notify) window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EVENT));
}

// ---- Customer session ------------------------------------------------------

/** A signed-in customer (field names match what the site already used). */
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
export interface CustomerSession {
  token: string;
  expiresAt: string;
  customer: User;
}

const CUSTOMER_KEY = 'amore_customer_session_v1';
export const CUSTOMER_SESSION_EVENT = 'amore_customer_session_changed';

export function getCustomerSession(): CustomerSession | null {
  if (typeof window === 'undefined') return null;
  return readSession(localStorage, CUSTOMER_KEY) as CustomerSession | null;
}

export function saveCustomerSession(session: CustomerSession): void {
  try {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(session));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new CustomEvent(CUSTOMER_SESSION_EVENT));
}

export function clearCustomerSession(): void {
  try {
    localStorage.removeItem(CUSTOMER_KEY);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new CustomEvent(CUSTOMER_SESSION_EVENT));
}

// ---- Rider sessions (the /rider app) ------------------------------------------

export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  branchId: 'akurana' | 'colombo' | 'arugambay';
  active: boolean;
  lastSeenAt: string | null;
}
export interface RiderSession {
  token: string;
  expiresAt: string;
  rider: RiderProfile;
}
const RIDER_KEY = 'amore_rider_session_v1';

export function getRiderSession(): RiderSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem(RIDER_KEY) || 'null') as RiderSession | null;
    return s && s.token && Date.parse(s.expiresAt) > Date.now() ? s : null;
  } catch {
    return null;
  }
}
export function saveRiderSession(session: RiderSession | null): void {
  try {
    if (session) localStorage.setItem(RIDER_KEY, JSON.stringify(session));
    else localStorage.removeItem(RIDER_KEY);
  } catch {
    /* storage blocked */
  }
}

// ---- Requests ----------------------------------------------------------------

/** Which sign-in to send: 'auto' = the admin session if there is one, else the customer's. */
export type Caller = 'auto' | 'admin' | 'customer' | 'rider' | 'none';

function tokenFor(caller: Caller): string | null {
  if (caller === 'none') return null;
  if (caller === 'rider') return getRiderSession()?.token ?? null;
  if (caller !== 'customer') {
    const session = getAdminSession();
    if (session || caller === 'admin') return session?.token ?? null;
  }
  return getCustomerSession()?.token ?? null;
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send a file (e.g. a photo) as the request body instead of JSON. */
  file?: Blob;
  as?: Caller;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenFor(opts.as ?? 'auto');
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.file) {
    body = opts.file;
    headers['Content-Type'] = opts.file.type || 'application/octet-stream';
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: opts.method || 'GET', headers, body });
  } catch {
    throw new ApiError(0, 'No connection to Amore. Check your internet and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The session ran out or was revoked (e.g. admin password changed): sign in again
    if (res.status === 401 && token?.startsWith('adm.')) clearAdminSession();
    if (res.status === 401 && token?.startsWith('cus.')) clearCustomerSession();
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data);
  }
  return data as T;
}

/** Worth trying again later (offline, server busy, sign-in not ready yet). */
export const isRetryable = (err: unknown) =>
  err instanceof ApiError ? err.status === 0 || err.status === 401 || err.status === 429 || err.status >= 500 : true;
