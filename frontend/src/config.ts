/**
 * Site-wide settings for Amore.
 *
 * Admin logins live on the backend (MongoDB; see `npm run set-admin`), and the Google
 * accounts allowed into the console are set with OWNER_EMAILS in the backend settings.
 */

/**
 * Online card payments need a real payment gateway (e.g. PayHere) behind them.
 * Until one is connected, card entry is hidden and delivery orders are cash on delivery.
 * (The backend refuses card orders too — see backend/src/orderRules.js.)
 */
export const ONLINE_CARD_PAYMENTS_ENABLED = false;

/**
 * Demo card payments: checkout offers "Card" for deliveries, which works with test cards only
 * (see utils/demoCard.ts). No money is taken; the order keeps the card's brand and last 4 digits
 * and shows as "Paid by card" in the console and the rider app. Set to false to hide it
 * (and DEMO_CARD_PAYMENTS in backend/src/orderRules.js).
 */
export const DEMO_CARD_PAYMENTS = true;

/**
 * A "Demo: see tomorrow" button on the rider app's Done page: shows what the rider sees on the
 * next day (Done starts empty; cash not handed in shows as from an earlier day). Nothing is
 * changed. Set to false to remove the button.
 */
export const RIDER_NEXT_DAY_DEMO = true;
