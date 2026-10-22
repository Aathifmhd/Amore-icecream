import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { col, getSetting, setSetting, now } from './db.js';

/*
 * Who is calling?
 *
 *   Customers   sign in with Google ("Sign in with Google" button in the browser). The browser
 *               sends us Google's signed sign-in (an ID token); we check it against Google's
 *               public keys and our GOOGLE_CLIENT_ID, then hand out our own customer session.
 *   Admins      sign in with name + password (stored in the `admins` collection as salted scrypt
 *               hashes) or, for owners listed in OWNER_EMAILS, with Google. They get an admin session.
 *   User code   an admin can set a 4–6 digit code on a device. The code is checked here, with a
 *               limit on wrong tries, so it can't be guessed offline.
 *
 * Every request sends `Authorization: Bearer <session>`: admin sessions start with "adm.",
 * customer sessions with "cus.".
 */

const scrypt = promisify(crypto.scrypt);

export const googleClientId = () => process.env.GOOGLE_CLIENT_ID || '';
// Overridable only so the tests can sign their own Google tokens
const GOOGLE_KEYS_URL = process.env.GOOGLE_JWKS_URL || 'https://www.googleapis.com/oauth2/v3/certs';
const googleKeys = createRemoteJWKSet(new URL(GOOGLE_KEYS_URL));

const ownerEmails = () =>
  (process.env.OWNER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const SESSION_DAYS = 30;
const CUSTOMER_SESSION_DAYS = 60;
const MAX_LOGIN_FAILURES = 8;
const LOGIN_LOCK_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// ---- Passwords & codes -----------------------------------------------------

export async function hashSecret(secret, salt = crypto.randomBytes(16).toString('base64')) {
  const key = await scrypt(String(secret).normalize('NFKC'), salt, 64);
  return { salt, hash: key.toString('base64') };
}

export async function secretMatches(secret, salt, hash) {
  if (!salt || !hash) return false;
  const key = await scrypt(String(secret).normalize('NFKC'), salt, 64);
  const expected = Buffer.from(hash, 'base64');
  return expected.length === key.length && crypto.timingSafeEqual(key, expected);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('base64');

export const usernameKey = (name) => String(name || '').trim().toLowerCase();

/** Create or update an admin login (used by the set-admin script and the first-start seed). */
export async function upsertAdmin(username, password) {
  const key = usernameKey(username);
  if (!/^[a-z0-9._-]{2,40}$/.test(key)) throw new Error('Admin name: 2–40 letters, digits, dot, dash or underscore');
  if (String(password).length < 8) throw new Error('Password must be at least 8 characters');
  const { salt, hash } = await hashSecret(password);
  const existing = await col('admins').findOne({ username: key });
  await col('admins').updateOne(
    { username: key },
    {
      $set: { username: key, displayName: String(username).trim(), salt, hash, failedLogins: 0, lockedUntil: null, updatedAt: now() },
      // A new password signs out every device and forgets their user codes
      $inc: { sessionVersion: 1 },
      $setOnInsert: { createdAt: now() },
    },
    { upsert: true }
  );
  if (existing) await col('admin_devices').deleteMany({ username: key });
  return key;
}

/** First start: create the admin from ADMIN_USERNAME / ADMIN_PASSWORD when there is none yet. */
export async function initAuth() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (ADMIN_USERNAME && ADMIN_PASSWORD && (await col('admins').countDocuments()) === 0) {
    await upsertAdmin(ADMIN_USERNAME, ADMIN_PASSWORD);
    console.log(`Created admin login "${ADMIN_USERNAME}"`);
  }
  await sessionSecret();
}

// ---- Admin session tokens ----------------------------------------------------

let cachedSecret = null;
async function sessionSecret() {
  if (cachedSecret) return cachedSecret;
  let secret = process.env.SESSION_SECRET || (await getSetting('session_secret'));
  if (!secret) {
    secret = crypto.randomBytes(48).toString('base64');
    await setSetting('session_secret', secret);
  }
  cachedSecret = secret;
  return secret;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// The kind of session ("adm" / "cus") is part of what is signed, so one can't pass for the other
async function sign(kind, payload) {
  const body = b64url(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', await sessionSecret()).update(`${kind}.${body}`).digest('base64url');
  return `${kind}.${body}.${mac}`;
}

async function readToken(token) {
  const [kind, body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', await sessionSecret()).update(`${kind}.${body}`).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/** Session for a name+password admin or a Google owner. */
export async function issueAdminSession(admin) {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const token = await sign(
    'adm',
    admin.google
      ? { sub: `google:${admin.email}`, exp }
      : { sub: admin.username, ver: admin.sessionVersion ?? 0, exp }
  );
  return { token, expiresAt: new Date(exp).toISOString(), admin: publicAdmin(admin) };
}

export const publicAdmin = (admin) =>
  admin.google
    ? { username: admin.email, displayName: admin.name || admin.email, google: true }
    : { username: admin.username, displayName: admin.displayName || admin.username, google: false };

async function adminFromToken(token) {
  const payload = await readToken(token);
  if (!payload) return null;
  if (payload.sub.startsWith('google:')) {
    const email = payload.sub.slice('google:'.length);
    return ownerEmails().includes(email) ? { google: true, email, username: email } : null;
  }
  const admin = await col('admins').findOne({ username: payload.sub });
  if (!admin || (admin.sessionVersion ?? 0) !== payload.ver) return null;
  return admin;
}

// ---- Google sign-in & customer sessions ---------------------------------------

/** Checks a Google sign-in (the ID token from the "Sign in with Google" button). */
export async function verifyGoogleCredential(credential) {
  if (!googleClientId()) throw new HttpError(503, 'Google sign-in is not set up yet (GOOGLE_CLIENT_ID is missing).');
  if (typeof credential !== 'string' || !credential) throw new HttpError(400, 'Missing Google sign-in');
  try {
    const { payload } = await jwtVerify(credential, googleKeys, {
      issuer: ['accounts.google.com', 'https://accounts.google.com'],
      audience: googleClientId(),
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('no subject');
    const str = (v) => (typeof v === 'string' ? v : null);
    return {
      sub: payload.sub,
      email: str(payload.email)?.toLowerCase() ?? null,
      emailVerified: payload.email_verified === true,
      name: str(payload.name),
      picture: str(payload.picture),
    };
  } catch {
    throw new HttpError(401, 'Google sign-in could not be checked. Please try again.');
  }
}

export const publicCustomer = (c) => ({ uid: c.uid, email: c.email, displayName: c.name, photoURL: c.picture });

/** A customer session after a Google sign-in. Orders are kept under uid "google:<Google account id>". */
export async function issueCustomerSession(google) {
  const exp = Date.now() + CUSTOMER_SESSION_DAYS * 24 * 3600 * 1000;
  const customer = { uid: `google:${google.sub}`, email: google.email, name: google.name, picture: google.picture };
  const token = await sign('cus', { ...customer, exp });
  return { token, expiresAt: new Date(exp).toISOString(), customer: publicCustomer(customer) };
}

async function customerFromToken(token) {
  const payload = await readToken(token);
  return payload?.uid ? { uid: payload.uid, email: payload.email, name: payload.name, picture: payload.picture } : null;
}

// ---- Middleware --------------------------------------------------------------

/** Sets req.admin or req.customer from the Authorization header (if any). Never rejects. */
export async function identify(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token.startsWith('adm.')) req.admin = await adminFromToken(token);
  else if (token.startsWith('cus.')) req.customer = await customerFromToken(token);
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.admin) throw new HttpError(401, 'Admin sign-in needed');
  next();
}

export function requireCustomer(req, res, next) {
  if (!req.customer) throw new HttpError(401, 'Please sign in first');
  next();
}

// ---- Sign-in flows (used by routes/admin.js) ------------------------------------

export async function passwordLogin(username, password) {
  const key = usernameKey(username);
  const admin = key ? await col('admins').findOne({ username: key }) : null;
  if (admin?.lockedUntil && new Date(admin.lockedUntil) > new Date()) {
    throw new HttpError(429, `Too many wrong tries. Try again after ${LOGIN_LOCK_MINUTES} minutes.`);
  }
  const ok = admin ? await secretMatches(password, admin.salt, admin.hash) : await hashSecret('x').then(() => false);
  if (!ok) {
    if (admin) {
      const failed = (admin.failedLogins || 0) + 1;
      await col('admins').updateOne(
        { username: key },
        {
          $set: {
            failedLogins: failed >= MAX_LOGIN_FAILURES ? 0 : failed,
            lockedUntil: failed >= MAX_LOGIN_FAILURES ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000).toISOString() : null,
          },
        }
      );
    }
    throw new HttpError(401, 'Wrong name or password');
  }
  await col('admins').updateOne({ username: key }, { $set: { failedLogins: 0, lockedUntil: null, lastLoginAt: now() } });
  return issueAdminSession(admin);
}

/** Owner sign-in with Google: `credential` is the ID token from the "Sign in with Google" button. */
export async function googleOwnerLogin(credential) {
  const user = await verifyGoogleCredential(credential);
  if (!user.emailVerified || !ownerEmails().includes(user.email)) {
    throw new HttpError(403, 'This Google account is not an Amore admin');
  }
  return issueAdminSession({ google: true, email: user.email, name: user.name });
}

/** Remember this device for `admin` with a user code. Returns the device's id + secret. */
export async function registerDevice(admin, code) {
  if (!/^\d{4,6}$/.test(String(code))) throw new HttpError(400, 'The code must be 4–6 digits');
  const deviceId = crypto.randomUUID();
  const deviceSecret = crypto.randomBytes(32).toString('base64url');
  const { salt, hash } = await hashSecret(code);
  await col('admin_devices').insertOne({
    deviceId,
    username: admin.username,
    google: Boolean(admin.google),
    displayName: publicAdmin(admin).displayName,
    secretHash: sha256(deviceSecret),
    codeSalt: salt,
    codeHash: hash,
    attempts: 0,
    sessionVersion: admin.sessionVersion ?? 0,
    createdAt: now(),
  });
  return { deviceId, deviceSecret };
}

async function findDevice(deviceId, deviceSecret) {
  if (typeof deviceId !== 'string' || typeof deviceSecret !== 'string') return null;
  const device = await col('admin_devices').findOne({ deviceId });
  if (!device) return null;
  const a = Buffer.from(sha256(deviceSecret));
  const b = Buffer.from(device.secretHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? device : null;
}

/** Unlock with a user code. Too many wrong codes forget the device (name + password needed again). */
export async function unlockWithCode(deviceId, deviceSecret, code) {
  const device = await findDevice(deviceId, deviceSecret);
  if (!device) throw new HttpError(410, 'This device is no longer remembered. Sign in with name and password.');

  let admin;
  if (device.google) {
    admin = ownerEmails().includes(device.username) ? { google: true, email: device.username, name: device.displayName } : null;
  } else {
    admin = await col('admins').findOne({ username: device.username });
    if (admin && (admin.sessionVersion ?? 0) !== device.sessionVersion) admin = null; // password changed since
  }
  if (!admin) {
    await col('admin_devices').deleteOne({ deviceId });
    throw new HttpError(410, 'This device is no longer remembered. Sign in with name and password.');
  }

  if (await secretMatches(String(code), device.codeSalt, device.codeHash)) {
    await col('admin_devices').updateOne({ deviceId }, { $set: { attempts: 0, lastUsedAt: now() } });
    return issueAdminSession(admin);
  }
  const attempts = (device.attempts || 0) + 1;
  if (attempts >= MAX_CODE_ATTEMPTS) {
    await col('admin_devices').deleteOne({ deviceId });
    throw new HttpError(410, 'Too many wrong codes. Sign in with name and password.');
  }
  await col('admin_devices').updateOne({ deviceId }, { $set: { attempts } });
  throw new HttpError(401, 'Wrong code', { triesLeft: MAX_CODE_ATTEMPTS - attempts });
}

export async function forgetDevice(deviceId, deviceSecret) {
  const device = await findDevice(deviceId, deviceSecret);
  if (device) await col('admin_devices').deleteOne({ deviceId });
}
