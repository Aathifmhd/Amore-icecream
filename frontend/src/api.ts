/**
 * Talks to the Amore backend (/api — see backend/ in this repository).
 *
 * Customers are identified by their Firebase sign-in (Google / email); admins by the
 * session the backend hands out at /admin. Each request sends the matching token.
 */
import { auth } from './firebase';

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

export interface AdminProfile {
  username: string;
  displayName: string;
  google: boolean;
}
export interface AdminSession {
  token: string;
  expiresAt: string;
  admin: AdminProfile;
}

const SESSION_KEY = 'amore_admin_session_v1';
export const ADMIN_SESSION_EVENT = 'amore_admin_session_changed';

function readSession(storage: Storage): AdminSession | null {
  try {
    const s = JSON.parse(storage.getItem(SESSION_KEY) || 'null') as AdminSession | null;
    return s && s.token && Date.parse(s.expiresAt) > Date.now() ? s : null;
  } catch {
    return null;
  }
}

/** The admin session in this browser, if any (a code-protected device keeps it for this visit only). */
export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null;
  return readSession(sessionStorage) || readSession(localStorage);
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

// ---- Requests ----------------------------------------------------------------

/** Which sign-in to send: 'auto' = the admin session if there is one, else the customer's. */
export type Caller = 'auto' | 'admin' | 'customer' | 'none';

async function customerToken(): Promise<string | null> {
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

async function tokenFor(caller: Caller): Promise<string | null> {
  if (caller === 'none') return null;
  if (caller !== 'customer') {
    const session = getAdminSession();
    if (session || caller === 'admin') return session?.token ?? null;
  }
  return customerToken();
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send a file (e.g. a photo) as the request body instead of JSON. */
  file?: Blob;
  as?: Caller;
  /** Send this token instead (e.g. a fresh Google sign-in for the owner login). */
  token?: string;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = opts.token ?? (await tokenFor(opts.as ?? 'auto'));
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
    // The admin session ran out or was revoked (e.g. password changed): back to the sign-in screen
    if (res.status === 401 && token?.startsWith('adm.')) clearAdminSession();
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data);
  }
  return data as T;
}

/** Worth trying again later (offline, server busy, sign-in not ready yet). */
export const isRetryable = (err: unknown) =>
  err instanceof ApiError ? err.status === 0 || err.status === 401 || err.status === 429 || err.status >= 500 : true;
