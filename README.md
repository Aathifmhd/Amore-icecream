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
| `/?page=admin` | Admin console (orders, kitchen stages, refunds, menu editing) |

## Admin access

Admins sign in with Google. Only the emails listed in **three places** get in, and
these must be kept in sync:

- `src/config.ts` → `ADMIN_EMAILS` (controls what the website shows)
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
