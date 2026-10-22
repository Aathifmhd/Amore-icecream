import { Router } from 'express';
import { googleClientId, issueCustomerSession, publicCustomer, requireCustomer, verifyGoogleCredential } from '../auth.js';

/*
 * Customer sign-in (Google only).
 *   GET  /config   the Google client id the "Sign in with Google" button needs
 *   POST /google   { credential } from that button  → customer session
 *   GET  /me       who this session belongs to
 */
const router = Router();

router.get('/config', (req, res) => {
  res.json({ googleClientId: googleClientId() || null });
});

router.post('/google', async (req, res) => {
  res.json(await issueCustomerSession(await verifyGoogleCredential(req.body?.credential)));
});

router.get('/me', requireCustomer, (req, res) => {
  res.json({ customer: publicCustomer(req.customer) });
});

export default router;
