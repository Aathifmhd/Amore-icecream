# Amore — Speciality Ice Cream, Coffee & Cakes

Storefront, online ordering and admin console for Amore's three parlours
(Akurana, Colombo, Arugam Bay).

```
frontend/   the website — React 19 + Vite + Tailwind
backend/    the API — Node + Express, data in MongoDB
```

| Piece | What it holds |
| --- | --- |
| **MongoDB** (`backend/`) | orders, menu changes and stock per branch, menu photos, admin logins, user codes, employee records |
| **Google sign-in** | customers sign in with Google; the backend checks the sign-in and gives them a session |
| **Built into the website** | the standard menu (`frontend/src/data/iceCreamData.ts`); the database only stores the admin's changes to it |

## Run locally

```bash
npm run setup                    # installs root, backend and frontend packages
cp backend/.env.example backend/.env
# put your MongoDB Atlas connection string in backend/.env (MONGODB_URI)
npm run set-admin -- Admin       # create the admin login (asks for the password)
npm run dev                      # API on :4100, website on http://localhost:3000
```

`npm run build` builds the website into `frontend/dist`; `npm start` then serves the
whole site (website + API) from the backend on one port.

## Pages

| URL | What it is |
| --- | --- |
| `/` | Home page |
| `/?page=menu` | Full menu and ordering |
| `/?confirmOrder=AMO-XXXXXX` | Order confirmation and live tracking |
| `/admin` | Admin console (orders, kitchen stages, refunds, menu editing) |

## API (`backend/src`)

| Route | Who |
| --- | --- |
| `GET /api/auth/config`, `POST /api/auth/google` | customer Google sign-in |
| `GET /api/menu` | everyone — the admin's menu changes and stock |
| `PUT / DELETE /api/menu/:id` | super admin — edit / remove an item |
| `PUT /api/menu/:id/stock` | super admin (any branch) or branch admin (own branch) — in stock / sold out |
| `PUT / DELETE /api/menu/:id/branch/:branch` | super admin (any branch) or branch admin (own branch) — that branch's own prices, photos and text / back to the standard |
| `POST /api/images`, `GET /api/images/:id` | admin uploads, everyone views |
| `/api/gallery` | admins see, super admin adds / removes photos in the photo gallery |
| `/api/activity` | super admin — the Action Center log (what happened, who, which branch; kept 90 days) |
| `GET /api/parlours`, `PUT /api/parlours/:id` | everyone reads / super admin sets — each parlour's map location and delivery distance |
| `POST /api/orders` | signed-in customer (checked like the old Firestore rules) or admin |
| `GET /api/orders/mine` | signed-in customer — their own orders |
| `GET / PATCH / DELETE /api/orders/:ref` | the customer who placed it (limited) or admin |
| `GET /api/orders?since=…` | admin — every order (a branch admin: their branch's), or what changed since the last check |
| `/api/admin/…` | admin sign-in, user codes (see `routes/admin.js`) |
| `/api/admin/users` | super admin — add, change and remove admin logins |
| `/api/employees` | admin — staff records (a branch admin: their branch's) |

Screens stay up to date by asking for changes every few seconds (orders in the console
every 5 s, a customer's order every 6–8 s, the menu every minute). Changes made in the
console show at once and are sent in the background; if the connection drops they wait
on the device and go through when it is back ("Saving N changes…" in the top bar).

## Admin access

The console is at **/admin** (it is not linked from the storefront).

**Roles.** There is one **super admin** (the first admin login, plus Google owners) and a
**branch admin** for each branch. The server enforces this on every request:

| | Super admin | Branch admin |
| --- | --- | --- |
| Dashboard | today for all branches (or one), each branch, latest activity | today for own branch |
| Action Center | everything that happens at every branch | — |
| Orders, refunds, reports | all branches | own branch only |
| Menu | add, edit, remove items (the standard for all branches); any branch's own version; stock at any branch | own branch's prices, photos and text; stock at own branch |
| Employees | every branch | own branch |
| Users (admin logins) | add, change, reset passwords, remove | — |
| Settings | sound, user code, account, **default prices**, **photo gallery** | sound, user code, account |

The console's **Settings** page is laid out like Cargo POS: sections grouped on the left (This
device: new-order sound, user code · Account · Menu: default prices, photo gallery — the Menu group
is super admin only), the open section on the right, and `?view=<section>` links straight to one.

The **photo gallery** (Settings → Photo gallery) is what menu photos are picked from: Amore's
own photos are built into the website (`CATALOG_PRESET_IMAGES` in `frontend/src/data/iceCreamData.ts`,
files in `frontend/src/assets/images`), and the super admin can upload more. Photos uploaded for
a menu item go into the gallery too, named after the item: at once when the super admin uploads
them, and otherwise the next time the gallery is opened (`POST /api/gallery/add-uploads`; the same
picture uploaded twice is added once, by its `sha256` fingerprint, and a photo deleted from the
gallery doesn't come back).

Stock is per branch: customers see an item as sold out only at the branch they order from,
and the server refuses an order with an item sold out at that branch.

Prices, photos and text can differ per branch. A branch admin's menu edits apply only to their
branch (stored as `branchOverrides.<branch>`, holding just the fields that differ); the super
admin's item is the default everywhere else. With **All branches** picked, the Menu page shows the
default price and names any branch that charges differently ("Cone LKR 850 (price different at
Colombo)"); each item's editor lists what a branch changed and can reset that branch to the
default. Looking at one branch shows that branch's prices only. Customers see, and are
charged, the version of the branch they order from.

**Settings → Default prices** (super admin) lists every item's default prices in one table: change
any of them, or set a whole column at once ("Set every biscuit cup to LKR 800"), then save. A
branch with its own price for an item keeps it.

- **Name + password** — stored in MongoDB as salted hashes. The super admin adds branch
  admins on the console's **Users** page. `npm run set-admin -- Admin` (typing is hidden)
  creates the super admin or resets a password if nobody can sign in. Changing a password signs
  that admin out on every device. Eight wrong passwords lock the login for 15 minutes.
- **User code** — after signing in on a device, an admin can set a 4–6 digit code; next
  time that device opens the console with just the code. The server checks the code, and
  five wrong tries make the device forget it (name + password needed again). "Lock" closes
  the console until the code is entered; "Forget this device" removes the code.
- **Owner** — Google accounts listed in `OWNER_EMAILS` (backend settings) can also sign in
  ("Owner? Sign in with Google").

## Settings (`backend/.env`, or Vercel → Settings → Environment Variables)

| Name | |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB` | database name (default `amore`) |
| `GOOGLE_CLIENT_ID` | OAuth client ID for "Sign in with Google" (see below) |
| `OWNER_EMAILS` | Google accounts allowed into the console |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | optional: creates the first admin on first start |
| `SESSION_SECRET` | optional: signs admin sessions (otherwise one is generated and kept in the database) |

## Customer sign-in (Google)

Customers sign in with Google's own "Sign in with Google" button. It needs an OAuth client
ID from Google Cloud (APIs & Services → Credentials → Create credentials → OAuth client ID →
Web application) with these **Authorized JavaScript origins**:

- `https://amore-icecream.vercel.app` (and any other address the site runs on)
- `http://localhost:3000` (for running it locally)

Put the client ID in `GOOGLE_CLIENT_ID` (Vercel settings and `backend/.env`). The client
secret is not needed. The OAuth consent screen must be published ("In production") so any
Google account can sign in, not only test users.

## Checkout

The tray (`QuickOrderModal.tsx`) runs in four numbered steps: delivery or pickup, address (or
the pickup parlour), name and phone, payment; the total and the order button stay at the bottom.
**Detect location & drop pin** (`LocationPickerModal.tsx`) opens a full-screen map that finds the
customer, keeps the pin in the middle while they move the map, and looks up the street under it
(MapLibre with OpenFreeMap's free vector map, recoloured in `utils/map.ts` to a light delivery-app look; street names from Nominatim; no keys needed). A delivery goes to the parlour nearest the pin
(`utils/branchLocation.ts`). The last order's name, phone and address are kept on that device for
the same Google account, so the next checkout is already filled in.

**Delivery range:** each parlour delivers within its own distance (6 km to start). The super admin
sets each parlour's map location and distance in the console (Settings → Locations & delivery);
they are kept in MongoDB (`backend/src/parlours.js`, the `parlour_locations` setting). The
customer's map shows every parlour as a dot with its delivery area as a dashed circle. A delivery
needs a map pin; a pin outside the range shows "We can't deliver to this location" with a button to
switch to pickup from the nearest parlour, and the backend refuses such orders and pin moves too
(`backend/src/orderRules.js`). Orders the console adds by hand are not checked.

## Deploy (Vercel)

`vercel.json` deploys both parts as one project: `/api/*` goes to the backend, everything
else to the website. Vercel builds and deploys every push to `main`. After changing a
setting in Vercel, redeploy so it takes effect.

## Payments

Online card payment is switched off (`ONLINE_CARD_PAYMENTS_ENABLED` in
`frontend/src/config.ts`) until a real payment gateway such as PayHere is connected.
Customers can pay cash on delivery or pay at the parlour; the backend refuses card orders
too (`backend/src/orderRules.js`).
