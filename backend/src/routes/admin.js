import { Router } from 'express';
import {
  HttpError,
  requireAdmin,
  passwordLogin,
  googleOwnerLogin,
  publicAdmin,
  registerDevice,
  unlockWithCode,
  forgetDevice,
} from '../auth.js';

/*
 * Admin console sign-in.
 *   POST /login           name + password            → session
 *   POST /google          Google ID token (Bearer)   → session, for owners in OWNER_EMAILS
 *   GET  /me              who this session belongs to
 *   POST /device          set a user code for this device (signed in)  → device id + secret
 *   POST /device/unlock   device id + secret + code  → session
 *   POST /device/forget   stop remembering this device
 */
const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    throw new HttpError(400, 'Enter your name and password');
  }
  res.json(await passwordLogin(username, password));
});

router.post('/google', async (req, res) => {
  res.json(await googleOwnerLogin(req.customer));
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: publicAdmin(req.admin) });
});

router.post('/device', requireAdmin, async (req, res) => {
  res.json(await registerDevice(req.admin, String(req.body?.code ?? '')));
});

router.post('/device/unlock', async (req, res) => {
  const { deviceId, deviceSecret, code } = req.body || {};
  res.json(await unlockWithCode(deviceId, deviceSecret, String(code ?? '')));
});

router.post('/device/forget', async (req, res) => {
  await forgetDevice(req.body?.deviceId, req.body?.deviceSecret);
  res.json({ ok: true });
});

export default router;
