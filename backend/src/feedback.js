import { col, now } from './db.js';
import { feedbackKey } from './auth.js';
import { mailConfigured, sendMail } from './mail.js';

/*
 * Customer feedback on an order, given on the feedback page (/feedback/<ref>?k=<key>):
 * overall stars (feedbackRating), quick tags, a comment, and the rider's stars if they weren't
 * given yet. The link is emailed one hour after the order is delivered or collected.
 *
 * Vercel runs no timers, so the emails go out when the console or the rider app next asks for
 * orders (at most every 2 minutes), or when /api/feedback/cron is called (CRON_SECRET).
 */

export const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://amore-icecream.vercel.app').replace(/\/$/, '');

// The quick tags customers can pick (the page shows the ones that fit their stars and order)
export const FEEDBACK_TAGS = [
  'Delicious', 'Generous portions', 'Arrived cold', 'Well packed', 'Friendly rider', 'Friendly staff', 'Quick pickup', 'Good value',
  'Melted', 'Arrived late', 'Wrong item', 'Missing item', 'Packaging', 'Too sweet', 'Long wait',
];

const SEND_AFTER_MS = 60 * 60 * 1000;
// Orders delivered longer ago than this are not emailed (e.g. old orders when this started)
const SEND_WITHIN_MS = 24 * 60 * 60 * 1000;
const RUN_EVERY_MS = 2 * 60 * 1000;
const BATCH = 4;
const MAX_TRIES = 3;

export const feedbackUrl = async (ref) => `${SITE_URL}/feedback/${encodeURIComponent(ref)}?k=${encodeURIComponent(await feedbackKey(ref))}`;
export const emailKey = (email) => String(email || '').trim().toLowerCase();

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function feedbackEmail(order, url) {
  const first = String(order.customerName || '').trim().split(/\s+/)[0] || 'there';
  const parlour = order.branchName || 'Amore';
  const items = (order.items || []).slice(0, 3).map((i) => `${i.quantity}× ${i.name}`);
  const more = (order.items || []).length > 3 ? ` and ${(order.items || []).length - 3} more` : '';
  const got = order.orderType === 'pickup' ? 'collecting' : 'ordering';
  const text = [
    `Hi ${first},`,
    '',
    `Thank you for ${got} from ${parlour}. We hope you enjoyed ${items.join(', ')}${more}!`,
    '',
    'Would you tell us how it was? It takes less than a minute:',
    url,
    '',
    'Every review is read by the Amore team.',
    '— Amore Ice Cream',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#FAF7F2;font-family:Arial,Helvetica,sans-serif;color:#241A18">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #E8DFC8;border-radius:20px;padding:28px">
<tr><td style="font-size:26px;font-weight:bold;color:#8C102A;font-family:Georgia,serif">amore</td></tr>
<tr><td style="padding-top:18px;font-size:20px;font-weight:bold">How was your order, ${escapeHtml(first)}?</td></tr>
<tr><td style="padding-top:10px;font-size:15px;line-height:22px;color:#5C4D44">Thank you for ${got} from ${escapeHtml(parlour)}. We hope you enjoyed ${escapeHtml(items.join(', '))}${escapeHtml(more)}!</td></tr>
<tr><td style="padding-top:8px;font-size:15px;line-height:22px;color:#5C4D44">Would you tell us how it was? It takes less than a minute.</td></tr>
<tr><td style="padding-top:22px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#8C102A;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 26px;border-radius:14px">&#9733; Write your feedback</a></td></tr>
<tr><td style="padding-top:22px;font-size:12px;line-height:18px;color:#8A7970">Order ${escapeHtml(order.orderReference)} · Every review is read by the Amore team.<br>Don’t want these emails? Open the link and choose “Stop these emails”.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: `How was your Amore order, ${first}? 🍦`, text, html };
}

/** Claim the next run (one at a time on every server, at most every RUN_EVERY_MS). */
async function claimRun() {
  const t = Date.now();
  try {
    await col('settings').findOneAndUpdate(
      { key: 'feedback_mail_run', value: { $lt: new Date(t - RUN_EVERY_MS).toISOString() } },
      { $set: { value: new Date(t).toISOString() } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    if (err.code === 11000) return false; // someone ran it recently
    throw err;
  }
}

/** Email the feedback link for orders delivered or collected an hour ago. Returns how many went out. */
export async function sendDueFeedbackEmails({ force = false } = {}) {
  if (!mailConfigured()) return { sent: 0, failed: 0, off: true };
  if (!force && !(await claimRun())) return { sent: 0, failed: 0 };
  const t = Date.now();
  const due = await col('orders')
    .find({
      status: 'delivered',
      deliveredAt: { $lte: new Date(t - SEND_AFTER_MS).toISOString(), $gte: new Date(t - SEND_WITHIN_MS).toISOString() },
      emailAddress: { $regex: '@' },
      feedbackEmailSentAt: { $exists: false },
      feedbackAt: { $exists: false },
      _feedbackMailTries: { $not: { $gte: MAX_TRIES } },
    })
    .sort({ deliveredAt: 1 })
    .limit(BATCH)
    .toArray();
  if (!due.length) return { sent: 0, failed: 0 };
  const stopped = new Set((await col('email_optouts').find({ email: { $in: due.map((o) => emailKey(o.emailAddress)) } }).toArray()).map((x) => x.email));

  let sent = 0;
  let failed = 0;
  for (const order of due) {
    const stamp = now();
    if (stopped.has(emailKey(order.emailAddress))) {
      await col('orders').updateOne({ orderReference: order.orderReference }, { $set: { _feedbackMailTries: MAX_TRIES, _feedbackMailSkipped: 'stopped' } });
      continue;
    }
    try {
      await sendMail({ to: order.emailAddress, ...feedbackEmail(order, await feedbackUrl(order.orderReference)) });
      await col('orders').updateOne({ orderReference: order.orderReference }, { $set: { feedbackEmailSentAt: stamp, _syncedAt: stamp } });
      sent++;
    } catch (err) {
      console.error(`Feedback email for ${order.orderReference} failed:`, err.message);
      await col('orders').updateOne({ orderReference: order.orderReference }, { $inc: { _feedbackMailTries: 1 } });
      failed++;
    }
  }
  return { sent, failed };
}

/** Run the email job alongside a request, without ever failing or holding it up for long. */
export async function kickFeedbackEmails() {
  try {
    await Promise.race([sendDueFeedbackEmails(), new Promise((resolve) => setTimeout(resolve, 7000))]);
  } catch (err) {
    console.error('Feedback emails:', err.message);
  }
}
