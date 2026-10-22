import crypto from 'node:crypto';
import { col, now } from './db.js';

/*
 * The Action Center's log: what happened, who did it and at which branch. Entries are
 * written after an action succeeds and are kept for ACTIVITY_DAYS (a TTL index removes older ones).
 *
 * Categories: order, refund, stock, menu, staff, users, gallery, signin
 */
export const ACTIVITY_DAYS = 90;
export const ACTIVITY_CATEGORIES = ['order', 'refund', 'stock', 'menu', 'staff', 'users', 'gallery', 'parlours', 'signin'];

const BRANCH_NAMES = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };
export const branchName = (id) => BRANCH_NAMES[id] || id || '';

/** Who did it, as shown in the Action Center. */
export function actorOf(req) {
  if (req.admin) {
    const a = req.admin;
    return a.google
      ? { kind: 'admin', username: a.email, name: a.name || a.email, role: 'superadmin', branchId: null }
      : { kind: 'admin', username: a.username, name: a.displayName || a.username, role: a.role === 'branch' ? 'branch' : 'superadmin', branchId: a.role === 'branch' ? a.branchId : null };
  }
  if (req.customer) return { kind: 'customer', username: null, name: req.customer.name || req.customer.email || 'A customer', role: 'customer', branchId: null };
  return { kind: 'system', username: null, name: 'Amore', role: 'system', branchId: null };
}

/**
 * Record something that happened. `summary` reads after the actor's name
 * ("accepted order AMO-7KQ4XP"). Never throws: a log problem must not undo the action.
 */
export async function logActivity(req, { category, summary, branchId = null, ref = null, actor = null }) {
  try {
    await col('activity').insertOne({
      id: `act_${crypto.randomBytes(8).toString('hex')}`,
      at: now(),
      atDate: new Date(),
      category,
      summary: String(summary).slice(0, 300),
      branchId,
      ref,
      actor: actor || actorOf(req),
    });
  } catch (err) {
    console.error('Could not record activity:', err.message);
  }
}

export const lkr = (n) => `LKR ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
