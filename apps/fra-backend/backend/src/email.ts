// ============================================================
// Outgoing email over SMTP, which most providers offer: AWS SES (SMTP
// interface), Postmark, SendGrid, Microsoft 365, Mailgun.
//
// Configuration:
//   SMTP_HOST, SMTP_PORT (587 unless set), SMTP_USER, SMTP_PASS
//   SMTP_SECURE=true for implicit TLS (port 465); otherwise STARTTLS is required,
//   unless SMTP_REQUIRE_TLS=false (local mail catchers such as Mailpit only)
//   EMAIL_FROM   e.g. "FRAUD-RISK.CO.UK <no-reply@fraud-risk.co.uk>"
//
// Without SMTP_HOST, emails are written to the server log in development (so a
// password reset can be completed locally) and production refuses to start.
// ============================================================

import nodemailer, { type Transporter } from 'nodemailer';
import { createLogger } from './logger.js';
import { PASSWORD_RESET_TTL_SECONDS } from './types.js';
import { webAppUrl } from './stripe.js';

const logger = createLogger('email');

export type Email = { to: string; subject: string; text: string; html: string };
type Transport = { sendMail: (message: Email & { from: string }) => Promise<unknown> };

let transport: Transport | null | undefined;

export const emailConfigured = () => !!process.env.SMTP_HOST;

function getTransport(): Transport | null {
  if (transport === undefined) {
    const host = process.env.SMTP_HOST;
    transport = host
      ? (nodemailer.createTransport({
          host,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          requireTLS: process.env.SMTP_SECURE !== 'true' && process.env.SMTP_REQUIRE_TLS !== 'false',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
        }) as Transporter as Transport)
      : null;
  }
  return transport;
}

/** Tests swap in a fake transport; null means "not configured", undefined re-reads the environment. */
export function setEmailTransport(fake: Transport | null | undefined): void {
  transport = fake;
}

export async function sendEmail(email: Email): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'FRAUD-RISK.CO.UK <no-reply@fraud-risk.co.uk>';
  const t = getTransport();
  if (!t) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email is not configured (SMTP_HOST)');
    logger.info('Email not sent (no SMTP_HOST); development copy follows', { to: email.to, subject: email.subject, text: email.text });
    return;
  }
  await t.sendMail({ from, ...email });
}

/** Sends without blocking the request; failures are logged, never shown to the caller. */
export function sendEmailInBackground(email: Email, context: Record<string, unknown> = {}): void {
  sendEmail(email).catch((err: unknown) =>
    logger.error('Email failed to send', { ...context, subject: email.subject, error: err instanceof Error ? err.message : String(err) }));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A plain, accessible HTML body: one column, real text, the link written out as well as linked. */
function layout(title: string, paragraphs: string[], action?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${esc(p)}</p>`).join('');
  const button = action
    ? `<p style="margin:24px 0"><a href="${esc(action.url)}" style="background:#1d70b8;color:#ffffff;padding:12px 20px;border-radius:4px;text-decoration:none;font-weight:600">${esc(action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:14px;color:#505a5f">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all">${esc(action.url)}</span></p>`
    : '';
  return `<!doctype html><html lang="en-GB"><body style="margin:0;padding:24px;background:#f3f2f1">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#0b0c0c">
<p style="margin:0 0 24px;font-weight:700">FRAUD-RISK.CO.UK</p>
<h1 style="margin:0 0 16px;font-size:22px">${esc(title)}</h1>${body}${button}
</div></body></html>`;
}

export function passwordResetEmail(to: string, name: string, token: string): Email {
  const url = `${webAppUrl()}/auth?mode=reset&token=${encodeURIComponent(token)}`;
  const minutes = Math.round(PASSWORD_RESET_TTL_SECONDS / 60);
  const lines = [
    `Hello ${name},`,
    `Someone asked to reset the password for your FRAUD-RISK.CO.UK account. Use the link below to choose a new password. It works once and expires in ${minutes} minutes.`,
    'If you did not ask for this, you can ignore this email: your password will not change.',
  ];
  return {
    to,
    subject: 'Reset your FRAUD-RISK.CO.UK password',
    text: `${lines[0]}\n\n${lines[1]}\n\n${url}\n\n${lines[2]}\n`,
    html: layout('Reset your password', lines, { label: 'Choose a new password', url }),
  };
}

export function passwordChangedEmail(to: string, name: string): Email {
  const lines = [
    `Hello ${name},`,
    'The password for your FRAUD-RISK.CO.UK account was just changed, and you have been signed out on your other devices.',
    'If this was not you, reset your password straight away and contact us at assessment@fraud-risk.co.uk.',
  ];
  return {
    to,
    subject: 'Your FRAUD-RISK.CO.UK password was changed',
    text: lines.join('\n\n') + '\n',
    html: layout('Your password was changed', lines, { label: 'Sign in', url: `${webAppUrl()}/auth` }),
  };
}
