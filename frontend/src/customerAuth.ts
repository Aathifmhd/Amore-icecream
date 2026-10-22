/**
 * Customer sign-in with Google.
 *
 * Google's own "Sign in with Google" button (Google Identity Services) gives the browser a
 * signed sign-in; the backend checks it and returns a customer session (see api.ts).
 * The same button is used for the owner's "Sign in with Google" at /admin.
 */
import { useEffect, useState } from 'react';
import {
  api,
  clearCustomerSession,
  CUSTOMER_SESSION_EVENT,
  getCustomerSession,
  saveCustomerSession,
  type CustomerSession,
  type User,
} from './api';

export type { User };

/** The signed-in customer, kept up to date across the page and other tabs. */
export function useCurrentUser(): User | null {
  const [user, setUser] = useState<User | null>(() => getCustomerSession()?.customer ?? null);
  useEffect(() => {
    const update = () => setUser(getCustomerSession()?.customer ?? null);
    window.addEventListener(CUSTOMER_SESSION_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(CUSTOMER_SESSION_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return user;
}

export async function signInWithGoogleCredential(credential: string): Promise<User> {
  const session = await api<CustomerSession>('/auth/google', { method: 'POST', body: { credential }, as: 'none' });
  saveCustomerSession(session);
  return session.customer;
}

export function signOutCustomer(): void {
  clearCustomerSession();
  // Don't sign them straight back in with Google's automatic sign-in
  window.google?.accounts.id.disableAutoSelect();
}

// ---- Google's button -------------------------------------------------------

interface GoogleIdApi {
  initialize(config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; auto_select?: boolean }): void;
  renderButton(
    parent: HTMLElement,
    options: { theme?: 'outline' | 'filled_blue'; size?: 'large' | 'medium'; text?: 'signin_with' | 'continue_with'; shape?: 'pill' | 'rectangular'; width?: number; logo_alignment?: 'left' | 'center' }
  ): void;
  disableAutoSelect(): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

export class GoogleSignInUnavailable extends Error {}

let clientIdRequest: Promise<string | null> | null = null;
const googleClientId = () =>
  (clientIdRequest ??= api<{ googleClientId: string | null }>('/auth/config', { as: 'none' })
    .then((r) => r.googleClientId)
    .catch((err) => {
      clientIdRequest = null; // try again next time
      throw err;
    }));

let scriptLoad: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoad = null;
      reject(new GoogleSignInUnavailable('Could not reach Google. Check your internet connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return scriptLoad;
}

/**
 * Shows Google's sign-in button inside `parent`. `onCredential` receives the signed sign-in
 * when the person picks their account. Throws GoogleSignInUnavailable if it can't be shown.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  onCredential: (credential: string) => void,
  { text = 'continue_with' }: { text?: 'signin_with' | 'continue_with' } = {}
): Promise<void> {
  const [clientId] = await Promise.all([googleClientId(), loadGoogleScript()]);
  if (!clientId) throw new GoogleSignInUnavailable('Google sign-in is not set up yet. Please try again later.');
  const id = window.google!.accounts.id;
  id.initialize({ client_id: clientId, callback: (r) => onCredential(r.credential), ux_mode: 'popup' });
  parent.replaceChildren();
  id.renderButton(parent, {
    theme: 'outline',
    size: 'large',
    text,
    shape: 'pill',
    logo_alignment: 'center',
    width: Math.min(400, Math.max(200, Math.round(parent.clientWidth || 320))),
  });
}
