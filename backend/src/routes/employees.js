import { Router } from 'express';
import crypto from 'node:crypto';
import { col, now } from '../db.js';
import { BRANCHES, HttpError, adminBranch, requireAdmin } from '../auth.js';
import { branchName, logActivity } from '../activity.js';

/*
 * Employee records. A branch admin keeps the records of their own branch;
 * the super admin sees (and can change) every branch's.
 * Records hold personal details (NIC, salary, photo), so they are never public:
 * the photo is stored inside the record, not as a public image link.
 *
 *   GET    /?branch=   list (branch admins always get their own branch)
 *   POST   /           add
 *   PATCH  /:id        change
 *   DELETE /:id        remove
 */
const router = Router();
router.use(requireAdmin);

const MAX_PHOTO_CHARS = 200_000; // a small JPEG (the console shrinks photos to 320 px)

const text = (max, required) => (v, label) => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `${label} is required`);
    return '';
  }
  if (typeof v !== 'string' || v.trim().length > max) throw new HttpError(400, `${label}: up to ${max} characters`);
  if (required && !v.trim()) throw new HttpError(400, `${label} is required`);
  return v.trim();
};

// Field → [label, check]. Checks return the cleaned value or throw 400.
const FIELDS = {
  fullName: ['Full name', text(100, true)],
  position: ['Position', text(60, true)],
  phone: ['Phone', text(30, true)],
  nic: [
    'NIC number',
    (v) => {
      const nic = text(12)(v, 'NIC number').toUpperCase();
      // Old NIC: 9 digits + V or X. New NIC: 12 digits.
      if (nic && !/^(\d{9}[VX]|\d{12})$/.test(nic)) throw new HttpError(400, 'NIC number: 9 digits and V/X, or 12 digits');
      return nic;
    },
  ],
  address: ['Address', text(300)],
  joinedOn: [
    'Date joined',
    (v) => {
      const d = text(10)(v, 'Date joined');
      if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)))) throw new HttpError(400, 'Date joined: use a valid date');
      return d;
    },
  ],
  emergencyName: ['Emergency contact name', text(100)],
  emergencyPhone: ['Emergency contact phone', text(30)],
  salaryLKR: [
    'Salary',
    (v) => {
      if (v === undefined || v === null || v === '') return null;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 10_000_000) throw new HttpError(400, 'Salary: a number of rupees');
      return Math.round(v);
    },
  ],
  notes: ['Notes', text(1000)],
  photo: [
    'Photo',
    (v) => {
      if (v === undefined || v === null || v === '') return '';
      if (typeof v !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) throw new HttpError(400, 'Photo: a JPEG, PNG or WebP image');
      if (v.length > MAX_PHOTO_CHARS) throw new HttpError(413, 'The photo is too large');
      return v;
    },
  ],
};

/** Cleaned fields from a request (only the ones sent when `partial`). */
function readFields(body, partial) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Expected a JSON object');
  const out = {};
  for (const [key, [label, check]] of Object.entries(FIELDS)) {
    if (partial && !(key in body)) continue;
    out[key] = check(body[key], label);
  }
  return out;
}

/** The branch this request may work on: a branch admin's own, or the one a super admin names. */
function branchFor(req, wanted) {
  const own = adminBranch(req.admin);
  if (own) {
    if (wanted !== undefined && wanted !== own) throw new HttpError(403, 'You can only keep employees for your own branch');
    return own;
  }
  if (!BRANCHES.includes(wanted)) throw new HttpError(400, 'Choose a branch');
  return wanted;
}

async function findEmployee(req, id) {
  const own = adminBranch(req.admin);
  const employee = await col('employees').findOne({ id: String(id), ...(own && { branchId: own }) }, { projection: { _id: 0 } });
  if (!employee) throw new HttpError(404, 'Employee not found');
  return employee;
}

router.get('/', async (req, res) => {
  const own = adminBranch(req.admin);
  const branch = own || (BRANCHES.includes(req.query.branch) ? req.query.branch : null);
  const employees = await col('employees')
    .find(branch ? { branchId: branch } : {}, { projection: { _id: 0 } })
    .sort({ branchId: 1, fullName: 1 })
    .toArray();
  res.json({ employees });
});

router.post('/', async (req, res) => {
  const employee = {
    id: `emp_${crypto.randomBytes(8).toString('hex')}`,
    branchId: branchFor(req, req.body?.branchId),
    ...readFields(req.body, false),
    createdAt: now(),
    updatedAt: now(),
    updatedBy: req.admin.username,
  };
  await col('employees').insertOne({ ...employee });
  await logActivity(req, { category: 'staff', summary: `added ${employee.fullName} (${employee.position}) to the staff at ${branchName(employee.branchId)}`, branchId: employee.branchId });
  res.status(201).json({ employee });
});

router.patch('/:id', async (req, res) => {
  const existing = await findEmployee(req, req.params.id);
  const set = { ...readFields(req.body, true), updatedAt: now(), updatedBy: req.admin.username };
  if (req.body?.branchId !== undefined) set.branchId = branchFor(req, req.body.branchId);
  const employee = await col('employees').findOneAndUpdate(
    { id: existing.id },
    { $set: set },
    { returnDocument: 'after', projection: { _id: 0 } }
  );
  const moved = employee.branchId !== existing.branchId ? ` and moved them to ${branchName(employee.branchId)}` : '';
  await logActivity(req, { category: 'staff', summary: `updated the details of ${employee.fullName}${moved}`, branchId: employee.branchId });
  res.json({ employee });
});

router.delete('/:id', async (req, res) => {
  const existing = await findEmployee(req, req.params.id);
  await col('employees').deleteOne({ id: existing.id });
  await logActivity(req, { category: 'staff', summary: `removed ${existing.fullName} from the staff at ${branchName(existing.branchId)}`, branchId: existing.branchId });
  res.json({ deleted: true });
});

export default router;
