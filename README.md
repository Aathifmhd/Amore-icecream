# Amore — Speciality Ice Cream, Coffee & Cakes

Storefront, online ordering and admin console for Amore's three parlours
(Akurana, Colombo, Arugam Bay). React 19 + Vite + Tailwind, hosted on Firebase.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

`npm run build` writes the production site to `dist/`.

## Pages

| URL | What it is |
| --- | --- |
| `/` | Home page |
| `/?page=menu` | Full menu and ordering |
| `/?confirmOrder=AMO-XXXXXX` | Order confirmation and live tracking |
| `/admin` | Admin console (orders, kitchen stages, refunds, menu editing) |

## Admin access

The console is at **/admin** (it is not linked from the storefront).

**Name + password.** Each admin sign-in name maps to a Firebase email/password
account in `ADMIN_ACCOUNTS` (`src/config.ts`), e.g. `Admin` →
`admin@amore-icecream.web.app`. The password is set only in the Firebase console
(Authentication → Users), never in this code.

**User code.** After signing in with name + password on a device, an admin can set
a 4–6 digit code; next time that device opens the console with just the code.
"Lock" keeps the device signed in behind the code. Five wrong codes sign the device
out, so the full name + password is needed again. "Forget this device" removes the
code and signs out.

**Owner.** The owner's Google account can also sign in ("Owner? Sign in with Google").

Admin accounts are listed in **three places** that must stay in sync:

- `src/config.ts` → `ADMIN_EMAILS` (Google) and `ADMIN_ACCOUNTS` (name + password)
- `firestore.rules` → `isAdmin()` (protects orders and the menu)
- `storage.rules` → `isAdmin()` (protects menu photo uploads)

The rules are what actually protect the data; after editing them, deploy with
`firebase deploy --only firestore,storage`.

## Payments

Online card payment is switched off (`ONLINE_CARD_PAYMENTS_ENABLED` in
`src/config.ts`) until a real payment gateway such as PayHere is connected.
Customers can pay cash on delivery or pay at the parlour. Turning card payments
back on also requires allowing `'card'` as a payment method in `firestore.rules`.

## Deploy

```bash
npm run build
firebase deploy
```
