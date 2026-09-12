/**
 * Admin Authentication & Session Management for Amore Ice Cream Operations
 * Configured credentials:
 * email / username: admin@email.com (also accepts 'admin')
 * password: 200011
 */

const ADMIN_STORAGE_KEY = 'amore_admin_session_auth_v1';
export const ADMIN_EMAIL = 'admin@email.com';
const ADMIN_PASSWORD_HASH = '200011';

export interface AdminSession {
  username: string;
  authenticatedAt: string;
  expiresAt: number;
}

/**
 * Validates admin credentials (supports both 'admin@email.com' and 'admin')
 */
export function verifyAdminCredentials(identifier: string, password: string): boolean {
  if (!identifier || !password) return false;
  const clean = identifier.trim().toLowerCase();
  const isMatch = clean === 'admin@email.com' || clean === 'admin';
  return isMatch && password.trim() === ADMIN_PASSWORD_HASH;
}

/**
 * Checks if the current admin session is valid and active
 */
export function isAdminAuthenticated(): boolean {
  try {
    const raw = sessionStorage.getItem(ADMIN_STORAGE_KEY) || localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return false;
    const session: AdminSession = JSON.parse(raw);
    if (session && (session.username === ADMIN_EMAIL || session.username === 'admin') && session.expiresAt > Date.now()) {
      return true;
    }
    // Expired
    clearAdminSession();
    return false;
  } catch {
    return false;
  }
}

/**
 * Saves authenticated admin session (valid for 8 hours)
 */
export function setAdminSession(remember: boolean = true): void {
  const session: AdminSession = {
    username: ADMIN_EMAIL,
    authenticatedAt: new Date().toISOString(),
    expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
  };
  const payload = JSON.stringify(session);
  sessionStorage.setItem(ADMIN_STORAGE_KEY, payload);
  if (remember) {
    localStorage.setItem(ADMIN_STORAGE_KEY, payload);
  }
}

/**
 * Logs out and clears admin session
 */
export function clearAdminSession(): void {
  try {
    sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear admin session:', err);
  }
}

