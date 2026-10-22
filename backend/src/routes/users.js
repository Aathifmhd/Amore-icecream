import { Router } from 'express';
import { createBranchAdmin, deleteAdmin, listAdmins, requireSuperAdmin, updateAdmin } from '../auth.js';

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
  res.status(201).json({ user: await createBranchAdmin({ username, displayName, branchId, password }) });
});

router.patch('/:username', async (req, res) => {
  const { displayName, branchId, password, unlock } = req.body || {};
  res.json(await updateAdmin(req.params.username, { displayName, branchId, password, unlock }, req.admin));
});

router.delete('/:username', async (req, res) => {
  await deleteAdmin(req.params.username, req.admin);
  res.json({ deleted: true });
});

export default router;
