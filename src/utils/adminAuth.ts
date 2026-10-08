/**
 * Admin access for the Amore operations console.
 *
 * Admins sign in with their Google account; access is granted to the verified
 * emails in ADMIN_EMAILS. The Firestore/Storage rules enforce the same list
 * server-side, so this check only decides what the UI shows.
 */
import { ADMIN_EMAILS } from '../config';
import type { User } from '../firebase';

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user || !user.email || !user.emailVerified) return false;
  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}
