import { Router } from 'express';
import { createBranchAdmin, deleteAdmin, listAdmins, requireSuperAdmin, updateAdmin } from '../auth.js';
import { branchName, logActivity } from '../activity.js';

/*
 * Admin logins — only the super admin may see or change them.
 *   GET    /             every admin login (never passwords)
 *   POST   /             add a branch admin { username, displayName, branchId, password }
 *   PATCH  /:username    { displayName?, branchId?, password?, unlock? }
 *   DELETE /:username    remove a branch admin
 */
const router = Router();
router.use(requireSuperAdmin);

router.get('/', async (req, res) => {
  res.json({ users: await listAdmins() });
});

router.post('/', async (req, res) => {
  const { username, displayName, branchId, password } = req.body || {};
  const user = await createBranchAdmin({ username, displayName, branchId, password });
  await logActivity(req, { category: 'users', summary: `added ${user.displayName} (“${user.username}”) as branch admin for ${branchName(user.branchId)}`, branchId: user.branchId });
  res.status(201).json({ user });
});

router.patch('/:username', async (req, res) => {
  const { displayName, branchId, password, unlock } = req.body || {};
  const result = await updateAdmin(req.params.username, { displayName, branchId, password, unlock }, req.admin);
  const u = result.user;
  const what = password ? 'reset the password of' : unlock ? 'unlocked the login of' : 'updated the login of';
  const moved = branchId !== undefined ? ` (branch: ${branchName(u.branchId)})` : '';
  await logActivity(req, { category: 'users', summary: `${what} ${u.displayName}${moved}`, branchId: u.branchId });
  res.json(result);
});

router.delete('/:username', async (req, res) => {
  await deleteAdmin(req.params.username, req.admin);
  await logActivity(req, { category: 'users', summary: `removed the login “${req.params.username}”` });
  res.json({ deleted: true });
});

export default router;
