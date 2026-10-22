/**
 * Site-wide settings for Amore.
 */

/**
 * Google accounts allowed into the admin console (/admin).
 * Keep in sync with isAdmin() in firestore.rules and storage.rules —
 * the rules are what actually protect the data; this list only controls the UI.
 */
export const ADMIN_EMAILS: string[] = ['aathifmhd2000@gmail.com'];

/**
 * Admin sign-in names → the Firebase email/password account behind each one.
 * Passwords live only in Firebase Authentication (set them in the Firebase console),
 * never in this code. Keep the emails in sync with isAdmin() in the rules files.
 */
export const ADMIN_ACCOUNTS: Record<string, string> = {
  admin: 'admin@amore-icecream.web.app',
};

/**
 * Online card payments need a real payment gateway (e.g. PayHere) behind them.
 * Until one is connected, card entry is hidden and delivery orders are cash on delivery.
 */
export const ONLINE_CARD_PAYMENTS_ENABLED = false;
