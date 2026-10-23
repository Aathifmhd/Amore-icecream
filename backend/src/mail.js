import nodemailer from 'nodemailer';

/*
 * Sending email (the feedback request after an order). Set in backend/.env or Vercel:
 *
 *   SMTP_USER   the mailbox that sends, e.g. amore.icecream@gmail.com
 *   SMTP_PASS   its password — for Gmail, an "app password" (Google account → Security →
 *               2-Step Verification → App passwords), not the normal password
 *   SMTP_HOST   default smtp.gmail.com     SMTP_PORT   default 465
 *   MAIL_FROM   default "Amore Ice Cream <SMTP_USER>"
 *
 * Without SMTP_USER and SMTP_PASS no email is sent.
 */

export const mailConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
export const mailFrom = () => process.env.MAIL_FROM || `Amore Ice Cream <${process.env.SMTP_USER}>`;

let transport = null;

export async function sendMail({ to, subject, html, text }) {
  if (!mailConfigured()) throw new Error('Email is not set up');
  const port = Number(process.env.SMTP_PORT || 465);
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  await transport.sendMail({ from: mailFrom(), to, subject, html, text });
}
