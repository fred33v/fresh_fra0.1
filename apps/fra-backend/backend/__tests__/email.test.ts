/// <reference types="jest" />

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { app, createAuthenticatedUser } from './helpers';
import { sendEmail, setEmailTransport, passwordResetEmail, type Email } from '../src/email';

const API = 'http://localhost/api/v1';
const post = (path: string, body: unknown) =>
  app.request(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const flush = () => new Promise((r) => setTimeout(r, 20)); // background sends

let sent: (Email & { from: string })[];
beforeEach(() => {
  sent = [];
  setEmailTransport({ sendMail: async (m) => { sent.push(m); } });
});
afterEach(() => { setEmailTransport(undefined); });

describe('Password reset email', () => {
  it('emails a link that opens the reset form with the token', async () => {
    const { email } = await createAuthenticatedUser();
    const res = await post('/auth/forgot-password', { email });
    expect(res.status).toBe(200);
    const token = ((await res.json()) as any).resetToken; // returned outside production only
    await flush();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: email, subject: 'Reset your FRAUD-RISK.CO.UK password' });
    const link = `http://localhost:8080/auth?mode=reset&token=${token}`;
    expect(sent[0].text).toContain(link);
    expect(sent[0].html).toContain(link.replace('&', '&amp;')); // HTML-escaped; browsers read it back as &
    expect(sent[0].text).toContain('expires in 60 minutes');
  });

  it('sends nothing for an unknown address, and answers the same way', async () => {
    const res = await post('/auth/forgot-password', { email: 'nobody-here@example.test' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).message).toMatch(/If an account with that email exists/);
    await flush();
    expect(sent).toHaveLength(0);
  });

  it('tells the account holder after the password is changed', async () => {
    const { email } = await createAuthenticatedUser();
    const token = ((await (await post('/auth/forgot-password', { email })).json()) as any).resetToken;
    const reset = await post('/auth/reset-password', { token, newPassword: 'A-new-password-123!' });
    expect(reset.status).toBe(200);
    await flush();
    expect(sent.map((m) => m.subject)).toEqual(['Reset your FRAUD-RISK.CO.UK password', 'Your FRAUD-RISK.CO.UK password was changed']);
    expect(sent[1].to).toBe(email);
  });

  it('keeps the reset response quick and successful even if the email fails', async () => {
    setEmailTransport({ sendMail: async () => { throw new Error('SMTP down'); } });
    const { email } = await createAuthenticatedUser();
    expect((await post('/auth/forgot-password', { email })).status).toBe(200);
    await flush();
  });

  it('escapes names in the HTML body', () => {
    const mail = passwordResetEmail('a@example.test', '<script>x</script>', 'tok');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});

describe('Without SMTP', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = env; });

  it('logs the email outside production, and refuses in production', async () => {
    setEmailTransport(null);
    await expect(sendEmail({ to: 'a@example.test', subject: 's', text: 't', html: 'h' })).resolves.toBeUndefined();
    process.env.NODE_ENV = 'production';
    await expect(sendEmail({ to: 'a@example.test', subject: 's', text: 't', html: 'h' })).rejects.toThrow('Email is not configured');
  });
});
