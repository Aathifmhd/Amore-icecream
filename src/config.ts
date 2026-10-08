/**
 * Site-wide settings for Amore.
 */

/**
 * Google accounts allowed into the admin console (?page=admin).
 * Keep this list in sync with isAdmin() in firestore.rules and storage.rules —
 * the rules are what actually protect the data; this list only controls the UI.
 */
export const ADMIN_EMAILS: string[] = ['aathifmhd2000@gmail.com'];

/**
 * Online card payments need a real payment gateway (e.g. PayHere) behind them.
 * Until one is connected, card entry is hidden and delivery orders are cash on delivery.
 */
export const ONLINE_CARD_PAYMENTS_ENABLED = false;
