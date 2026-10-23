import { Router } from 'express';
import crypto from 'node:crypto';
import { col, now, PUBLIC } from '../db.js';
import { BRANCHES, HttpError, adminBranch, phoneKey, publicRider, requireAdmin, riderPinFields } from '../auth.js';
import { branchName, logActivity, lkr } from '../activity.js';
import { collectsCash, readyQuery, riderOrderView, startOfTodayColombo } from '../riderOrders.js';
import { cashByRider } from '../riderCash.js';
import { ratingSummary } from '../riderRatings.js';

/*
 * Riders, managed from the console (a branch admin: their own parlour's riders).
 *
 *   GET    /                    riders with what they are doing now and today, + orders waiting for a rider
 *   GET    /photos              the riders' photos (kept out of the list, which is asked for every few seconds)
 *   GET    /:id/deliveries      a rider's latest deliveries
 *   POST   /                    { name, phone, branchId, pin, ...details } add a rider
 *   PATCH  /:id                 { name?, phone?, branchId?, active?, pin?, ...details } (a new PIN or switching off signs them out)
 *
 * Details (personal, for the console only — never the rider app or customers): fullName, nic,
 * joinedOn, emergencyPhone, emergencyName, address, photo. All but the photo and the emergency
 * contact's name are needed for a new rider; once given they can be changed but not emptied.
 *   DELETE /:id                 remove a rider (not while they are out with orders or hold cash)
 */
const router = Router();
router.use(requireAdmin);

const scope = (req) => {
  const branch = adminBranch(req.admin);
  return branch ? { branchId: branch } : {};
};

async function findRider(req) {
  const rider = await col('riders').findOne({ id: req.params.id, ...scope(req) });
  if (!rider) throw new HttpError(404, 'Rider not found');
  return rider;
}

const cleanName = (v) => {
  const name = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 60) throw new HttpError(400, 'Give the rider a name (2–60 letters)');
  return name;
};
const cleanPhone = (v) => {
  const phone = typeof v === 'string' ? v.trim() : '';
  if (phoneKey(phone).length !== 9 || phone.length > 20) throw new HttpError(400, 'Enter the rider’s mobile number, e.g. 077 123 4567');
  return phone;
};
const cleanBranch = (req, v) => {
  const own = adminBranch(req.admin);
  if (own) return own;
  if (!BRANCHES.includes(v)) throw new HttpError(400, 'Choose the rider’s parlour');
  return v;
};
const MAX_PHOTO_CHARS = 200_000; // a small JPEG (the console shrinks photos to 320 px)

const text = (max) => (v, label) => {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string' || v.trim().length > max) throw new HttpError(400, `${label}: up to ${max} characters`);
  return v.trim();
};

// Detail → [label, needed for a new rider, check]. Same rules as employee records (routes/employees.js).
const DETAILS = {
  fullName: ['Full name', true, text(100)],
  nic: [
    'NIC number',
    true,
    (v, label) => {
      const nic = text(12)(v, label).toUpperCase();
      // Old NIC: 9 digits + V or X. New NIC: 12 digits.
      if (nic && !/^(\d{9}[VX]|\d{12})$/.test(nic)) throw new HttpError(400, 'NIC number: 9 digits and V/X, or 12 digits');
      return nic;
    },
  ],
  joinedOn: [
    'Joined date',
    true,
    (v, label) => {
      const d = text(10)(v, label);
      if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)))) throw new HttpError(400, 'Joined date: use a valid date');
      return d;
    },
  ],
  emergencyPhone: [
    'Emergency contact number',
    true,
    (v, label) => {
      const p = text(20)(v, label);
      if (p && phoneKey(p).length !== 9) throw new HttpError(400, 'Emergency contact number: a phone number, e.g. 077 123 4567');
      return p;
    },
  ],
  emergencyName: ['Emergency contact name', false, text(100)],
  address: ['Address', true, text(300)],
  photo: [
    'Photo',
    false,
    (v) => {
      if (v === undefined || v === null || v === '') return '';
      if (typeof v !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) throw new HttpError(400, 'Photo: a JPEG, PNG or WebP image');
      if (v.length > MAX_PHOTO_CHARS) throw new HttpError(413, 'The photo is too large');
      return v;
    },
  ],
};

/**
 * Cleaned details from a request. A new rider (`existing` null) needs every required one;
 * a change may fill in missing ones, but not empty one that was given.
 */
function readDetails(body, existing) {
  const out = {};
  for (const [key, [label, needed, check]] of Object.entries(DETAILS)) {
    if (existing && !(key in body)) continue;
    const value = check(body[key], label);
    if (needed && !value && (!existing || existing[key])) throw new HttpError(400, `${label} is needed`);
    out[key] = value;
  }
  return out;
}

/** What the console shows of a rider (personal details, but not the photo) */
const riderForConsole = (r) => ({
  ...publicRider(r),
  ...Object.fromEntries(Object.keys(DETAILS).filter((k) => k !== 'photo').map((k) => [k, r[k] || ''])),
  hasPhoto: Boolean(r.photo),
});

const phoneTaken = async (phone, exceptId) => {
  const other = await col('riders').findOne({ phoneKey: phoneKey(phone), ...(exceptId && { id: { $ne: exceptId } }) });
  if (other) throw new HttpError(409, `${other.name} already uses this phone number`);
};

router.get('/', async (req, res) => {
  const riders = await col('riders').find(scope(req)).sort({ name: 1 }).toArray();
  const ids = riders.map((r) => r.id);
  const today = startOfTodayColombo();
  const branches = adminBranch(req.admin) ? [adminBranch(req.admin)] : BRANCHES;
  const [active, waiting, cash, ratings] = await Promise.all([
    col('orders')
      .find({ riderId: { $in: ids }, $or: [{ status: 'on_the_way' }, { status: 'delivered', deliveredAt: { $gte: today } }] }, PUBLIC)
      .toArray(),
    col('orders').find({ $or: branches.map((b) => readyQuery(b)) }, PUBLIC).sort({ readyAt: 1 }).toArray(),
    cashByRider(ids),
    ratingSummary(ids),
  ]);
  res.json({
    riders: riders.map((r) => {
      const mine = active.filter((o) => o.riderId === r.id);
      const out = mine.filter((o) => o.status === 'on_the_way');
      const done = mine.filter((o) => o.status === 'delivered');
      return {
        ...riderForConsole(r),
        outWith: out.map((o) => ({ orderReference: o.orderReference, customerName: o.customerName, city: o.city, onTheWayAt: o.onTheWayAt, grandTotalLKR: o.grandTotalLKR, collectCash: collectsCash(o) })),
        deliveredToday: done.length,
        cashToday: done.reduce((s, o) => s + (o.cashCollectedLKR || 0), 0),
        // Cash still with the rider: collected today and on its way back
        cashOnTheWay: out.filter(collectsCash).reduce((s, o) => s + (o.grandTotalLKR || 0), 0),
        // Cash from delivered orders not yet handed in at the parlour (Cash collection page)
        holdingLKR: cash[r.id].holdingLKR,
        rating: ratings[r.id],
      };
    }),
    waiting: waiting.map(riderOrderView),
    serverTime: now(),
  });
});

router.get('/photos', async (req, res) => {
  const riders = await col('riders').find({ ...scope(req), photo: { $nin: [null, ''] } }, { projection: { _id: 0, id: 1, photo: 1 } }).toArray();
  res.json({ photos: Object.fromEntries(riders.map((r) => [r.id, r.photo])) });
});

router.get('/:id/deliveries', async (req, res) => {
  const rider = await findRider(req);
  const orders = await col('orders')
    .find({ riderId: rider.id, status: { $in: ['on_the_way', 'delivered'] } }, PUBLIC)
    .sort({ onTheWayAt: -1 })
    .limit(60)
    .toArray();
  // The console also sees what customers wrote about the rider
  res.json({ rider: publicRider(rider), deliveries: orders.map((o) => ({ ...riderOrderView(o), riderFeedback: o.riderFeedback || '' })) });
});

router.post('/', async (req, res) => {
  const { name, phone, branchId, pin } = req.body || {};
  const rider = {
    id: `rdr_${crypto.randomBytes(8).toString('hex')}`,
    name: cleanName(name),
    phone: cleanPhone(phone),
    branchId: cleanBranch(req, branchId),
    ...readDetails(req.body || {}, null),
    active: true,
    sessionVersion: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  rider.phoneKey = phoneKey(rider.phone);
  await phoneTaken(rider.phone);
  Object.assign(rider, await riderPinFields(pin));
  await col('riders').insertOne({ ...rider });
  await logActivity(req, { category: 'riders', summary: `added ${rider.name} as a rider for ${branchName(rider.branchId)}`, branchId: rider.branchId });
  res.status(201).json({ rider: riderForConsole(rider) });
});

router.patch('/:id', async (req, res) => {
  const rider = await findRider(req);
  const body = req.body || {};
  const set = { updatedAt: now(), ...readDetails(body, rider) };
  const said = [];
  if (body.name !== undefined) set.name = cleanName(body.name);
  if (body.phone !== undefined) {
    set.phone = cleanPhone(body.phone);
    set.phoneKey = phoneKey(set.phone);
    await phoneTaken(set.phone, rider.id);
  }
  if (body.branchId !== undefined && !adminBranch(req.admin)) {
    set.branchId = cleanBranch(req, body.branchId);
    if (set.branchId !== rider.branchId) said.push(`moved to ${branchName(set.branchId)}`);
  }
  let signOut = false;
  if (body.pin !== undefined) {
    Object.assign(set, await riderPinFields(body.pin));
    said.push('set a new PIN');
    signOut = true;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw new HttpError(400, 'Say whether the rider is active');
    if (!body.active && (await col('orders').countDocuments({ riderId: rider.id, status: 'on_the_way' }))) {
      throw new HttpError(409, `${rider.name} is out with orders. Mark them delivered or handed back first.`);
    }
    set.active = body.active;
    if (body.active !== (rider.active !== false)) said.push(body.active ? 'switched on' : 'switched off');
    if (!body.active) signOut = true;
  }
  await col('riders').updateOne({ id: rider.id }, { $set: set, ...(signOut && { $inc: { sessionVersion: 1 } }) });
  const after = await col('riders').findOne({ id: rider.id });
  const what = said.length ? said.join(', ') : 'updated the details';
  await logActivity(req, { category: 'riders', summary: `rider ${after.name}: ${what}`, branchId: after.branchId });
  res.json({ rider: riderForConsole(after) });
});

router.delete('/:id', async (req, res) => {
  const rider = await findRider(req);
  if (await col('orders').countDocuments({ riderId: rider.id, status: 'on_the_way' })) {
    throw new HttpError(409, `${rider.name} is out with orders. Mark them delivered or handed back first.`);
  }
  const { holdingLKR } = (await cashByRider([rider.id]))[rider.id];
  if (holdingLKR > 0) throw new HttpError(409, `${rider.name} still holds ${lkr(holdingLKR)} cash. Receive it on the Cash collection page first.`);
  await col('riders').deleteOne({ id: rider.id });
  await logActivity(req, { category: 'riders', summary: `removed the rider ${rider.name} (${branchName(rider.branchId)})`, branchId: rider.branchId });
  res.json({ deleted: true });
});

export default router;
