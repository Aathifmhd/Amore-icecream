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
import { logActivity } from '../activity.js';

const SECURITY = { kind: 'system', username: null, name: 'Security', role: 'system', branchId: null };

/** A successful sign-in, for the Action Center. */
function logSignIn(req, session, how) {
  const a = session.admin;
  return logActivity(req, {
    category: 'signin',
    summary: `signed in ${how}`,
    branchId: a.branchId,
    actor: { kind: 'admin', username: a.username, name: a.displayName, role: a.role, branchId: a.branchId },
  });
}

/*
 * Admin console sign-in.
 *   POST /login           name + password            → session
 *   POST /google          { credential } from "Sign in with Google" → session, for owners in OWNER_EMAILS
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
  try {
    const session = await passwordLogin(username, password);
    await logSignIn(req, session, 'with name and password');
    res.json(session);
  } catch (err) {
    if (err.extra?.justLocked) {
      await logActivity(req, {
        category: 'signin',
        summary: `locked the login “${String(username).trim().toLowerCase()}” for 15 minutes after too many wrong passwords`,
        actor: SECURITY,
      });
    }
    throw err;
  }
});

router.post('/google', async (req, res) => {
  const session = await googleOwnerLogin(req.body?.credential);
  await logSignIn(req, session, 'with Google');
  res.json(session);
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: publicAdmin(req.admin) });
});

router.post('/device', requireAdmin, async (req, res) => {
  res.json(await registerDevice(req.admin, String(req.body?.code ?? '')));
});

router.post('/device/unlock', async (req, res) => {
  const { deviceId, deviceSecret, code } = req.body || {};
  try {
    const session = await unlockWithCode(deviceId, deviceSecret, String(code ?? ''));
    await logSignIn(req, session, 'with their user code');
    res.json(session);
  } catch (err) {
    if (err.extra?.tooManyCodes) {
      await logActivity(req, { category: 'signin', summary: `made a device forget the user code of “${err.extra.username}” after 5 wrong tries`, actor: SECURITY });
      delete err.extra.username;
    }
    throw err;
  }
});

router.post('/device/forget', async (req, res) => {
  await forgetDevice(req.body?.deviceId, req.body?.deviceSecret);
  res.json({ ok: true });
});

export default router;
