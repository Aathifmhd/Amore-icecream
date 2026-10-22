import { MongoClient } from 'mongodb';
import path from 'node:path';

/*
 * MongoDB data layer for Amore.
 *
 * Collections
 *   orders          one document per order / refund record, keyed by `orderReference`
 *   deleted_orders  references of deleted orders (so open consoles drop them too)
 *   menu_items      admin changes to the built-in menu: edited / added items, `isDeleted` tombstones
 *   images          menu photos uploaded from the console
 *   admins          admin sign-in names with salted password hashes
 *   admin_devices   devices where an admin set a user code (salted hash, wrong-try count)
 *   employees       staff records per branch (kept by the branch admins)
 *   gallery         photos the super admin added to the photo gallery (files are in images)
 *   settings        small key/value settings (e.g. the session-signing secret)
 *
 * Connection: MONGODB_URI (+ optional MONGODB_DB, default "amore").
 * Locally they are read from backend/.env; on Vercel set them as environment variables.
 */
try {
  process.loadEnvFile(path.join(import.meta.dirname, '..', '.env'));
} catch {
  /* no .env file — use the environment */
}

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'amore';
export const DB_LABEL = `MongoDB (${DB_NAME})`;

let client;
let database;

// One client per running copy of the backend (serverless copies reuse it between requests)
export async function connect() {
  if (database) return database;
  if (!URI) throw new Error('MONGODB_URI is not set. Put it in backend/.env (or the hosting environment variables).');
  globalThis.__amoreMongo ??= new MongoClient(URI, { serverSelectionTimeoutMS: 15000, maxPoolSize: 20 }).connect();
  client = await globalThis.__amoreMongo;
  database = client.db(DB_NAME);
  return database;
}

export async function close() {
  if (client) await client.close();
  globalThis.__amoreMongo = null;
  client = null;
  database = null;
}

export const col = (name) => {
  if (!database) throw new Error('Database not connected yet');
  return database.collection(name);
};

export const now = () => new Date().toISOString();

/** Leaves out Mongo's _id and our own bookkeeping fields (those starting with "_") when reading. */
export const PUBLIC = { projection: { _id: 0, _syncedAt: 0, _placedAt: 0 } };

/** Connect and create indexes (safe to run on every start). */
export async function setup() {
  await connect();
  await Promise.all([
    col('orders').createIndex({ orderReference: 1 }, { unique: true }),
    col('orders').createIndex({ userId: 1, createdAt: -1 }),
    col('orders').createIndex({ _syncedAt: 1 }),
    col('orders').createIndex({ userId: 1, _placedAt: 1 }),
    col('deleted_orders').createIndex({ orderReference: 1 }, { unique: true }),
    col('deleted_orders').createIndex({ deletedAt: 1 }),
    col('menu_items').createIndex({ id: 1 }, { unique: true }),
    col('admins').createIndex({ username: 1 }, { unique: true }),
    col('admin_devices').createIndex({ deviceId: 1 }, { unique: true }),
    col('admin_devices').createIndex({ username: 1 }),
    col('images').createIndex({ id: 1 }, { unique: true }),
    col('employees').createIndex({ id: 1 }, { unique: true }),
    col('employees').createIndex({ branchId: 1, fullName: 1 }),
    col('gallery').createIndex({ id: 1 }, { unique: true }),
    col('deleted_orders').createIndex({ branchId: 1, deletedAt: 1 }),
    col('settings').createIndex({ key: 1 }, { unique: true }),
  ]);
}

export async function getSetting(key) {
  return (await col('settings').findOne({ key }))?.value ?? null;
}
export async function setSetting(key, value) {
  await col('settings').updateOne({ key }, { $set: { key, value } }, { upsert: true });
}
