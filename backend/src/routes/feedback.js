import { Router } from 'express';
import { col, now } from '../db.js';
import { HttpError, adminBranch, feedbackKeyFits, requireAdmin } from '../auth.js';
import { logActivity } from '../activity.js';
import { mailConfigured, mailFrom } from '../mail.js';
import { FEEDBACK_TAGS, emailKey, feedbackUrl, sendDueFeedbackEmails } from '../feedback.js';

/*
 * Feedback on an order (feedback.js).
 *
 *   GET  /order/:ref?k=        the feedback page: what was ordered, and any feedback already given
 *   POST /order/:ref?k=        { rating, comment?, tags?, riderRating? } send it (once)
 *   POST /order/:ref/stop?k=   no more feedback emails to this address
 *   GET  /status               console: whether feedback emails are set up, and how many went out
 *   GET  /link/:ref            console: the order's feedback link (to send on WhatsApp)
 *   GET  /cron                 send the due emails now (Authorization: Bearer CRON_SECRET)
 *
 * The page needs no sign-in: the key in the link (?k=) is signed for that one order.
 */
const router = Router();

async function orderForKey(req) {
  const ref = req.params.ref;
  if (!(await feedbackKeyFits(req.query.k, ref))) throw new HttpError(403, 'This feedback link doesn’t work. It may have expired.');
  const order = await col('orders').findOne({ orderReference: ref });
  if (!order) throw new HttpError(404, 'We couldn’t find this order.');
  return order;
}

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

/** What the page shows: no address, phone or email */
const pageView = (o) => ({
  orderReference: o.orderReference,
  customerFirstName: firstName(o.customerName),
  branchName: o.branchName,
  orderType: o.orderType,
  status: o.status,
  deliveredAt: o.deliveredAt || null,
  items: (o.items || []).map((i) => ({ name: i.name, format: i.format || null, quantity: i.quantity })),
  riderFirstName: firstName(o.riderName) || null,
  riderRated: Boolean(o.riderRating),
  feedback: o.feedbackAt ? { rating: o.feedbackRating, comment: o.feedbackComment || '', tags: o.feedbackTags || [], at: o.feedbackAt } : null,
});

router.get('/order/:ref', async (req, res) => res.json({ order: pageView(await orderForKey(req)) }));

router.post('/order/:ref', async (req, res) => {
  const order = await orderForKey(req);
  if (order.status !== 'delivered') throw new HttpError(409, 'You can give feedback once you have your order.');
  if (order.feedbackAt) throw new HttpError(409, 'You already sent feedback for this order. Thank you!');
  const { rating, comment, tags, riderRating } = req.body || {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Choose 1 to 5 stars');
  const text = typeof comment === 'string' ? comment.trim().slice(0, 1000) : '';
  const picked = Array.isArray(tags) ? [...new Set(tags.filter((t) => FEEDBACK_TAGS.includes(t)))] : [];
  const t = now();
  const set = { feedbackRating: rating, feedbackTags: picked, feedbackAt: t, updatedAt: t, _syncedAt: t, ...(text && { feedbackComment: text }) };
  // The rider's stars, if they weren't given when the order arrived
  const rateRider = order.riderId && !order.riderRating && Number.isInteger(riderRating) && riderRating >= 1 && riderRating <= 5;
  if (rateRider) Object.assign(set, { riderRating, ratedAt: t });

  const saved = await col('orders').findOneAndUpdate(
    { orderReference: order.orderReference, feedbackAt: { $exists: false } },
    { $set: set },
    { returnDocument: 'after' }
  );
  if (!saved) throw new HttpError(409, 'You already sent feedback for this order. Thank you!');
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  await logActivity(req, {
    category: 'feedback',
    summary: `left feedback on order ${order.orderReference}: ${stars}${text ? ` — “${text.slice(0, 120)}”` : ''}`,
    branchId: order.branchId,
    ref: order.orderReference,
    actor: { kind: 'customer', username: null, name: order.customerName || 'A customer', role: 'customer', branchId: null },
  });
  res.json({ order: pageView(saved) });
});

router.post('/order/:ref/stop', async (req, res) => {
  const order = await orderForKey(req);
  const email = emailKey(order.emailAddress);
  if (email) await col('email_optouts').updateOne({ email }, { $set: { email, at: now() } }, { upsert: true });
  res.json({ stopped: true });
});

router.get('/status', requireAdmin, async (req, res) => {
  const branch = adminBranch(req.admin);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const sentThisWeek = await col('orders').countDocuments({ feedbackEmailSentAt: { $gte: since }, ...(branch && { branchId: branch }) });
  res.json({ emailOn: mailConfigured(), from: mailConfigured() ? mailFrom() : null, sentThisWeek });
});

router.get('/link/:ref', requireAdmin, async (req, res) => {
  const branch = adminBranch(req.admin);
  const order = await col('orders').findOne({ orderReference: req.params.ref, ...(branch && { branchId: branch }) });
  if (!order) throw new HttpError(404, 'Order not found');
  res.json({ url: await feedbackUrl(order.orderReference) });
});

router.get('/cron', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) throw new HttpError(401, 'Not allowed');
  res.json(await sendDueFeedbackEmails({ force: true }));
});

export default router;
