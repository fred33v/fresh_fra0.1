import { describe, it, expect } from '@jest/globals';
import { app, signUpAndConfirm } from './helpers';
import { setPasswordResetToken, setEmailVerificationToken, consumePasswordResetToken, consumeEmailVerificationToken } from '../src/db/index';
import { passwordResetTokens, emailVerificationTokens } from '../src/stores';
import { hashToken } from '../src/db/tokens';
const post = (path: string, body: unknown) => app.request('http://localhost/api/v1/auth/'+path, {
  method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body),
});
describe('single-use account links', () => {
  it('accepts only one concurrent password reset and invalidates the previous refresh session', async () => {
    const account = await signUpAndConfirm({ email: `link-${crypto.randomUUID()}@example.test`, password:'SecurePass123!', name:'Link test' });
    const token=crypto.randomUUID();await setPasswordResetToken(token, account.json.data.user.userId);
    const responses=await Promise.all(['Replacement123!','Replacement456!'].map(newPassword=>post('reset-password',{token,newPassword})));
    expect(responses.map(r=>r.status).sort()).toEqual([200,400]);
    expect((await post('refresh',{refreshToken:account.json.data.refreshToken})).status).toBe(401);
  });
  it('confirms a link and issues a session only once under concurrency', async () => {
    const signup=await post('signup',{ email:`verify-${crypto.randomUUID()}@example.test`,password:'SecurePass123!',name:'Verify test' });
    const body=await signup.json() as {data:{verificationToken:string}};
    const responses=await Promise.all([post('verify-email',{token:body.data.verificationToken}),post('verify-email',{token:body.data.verificationToken})]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,400]);
  });
  it('rejects expired and missing claims without restoring them', async () => {
    const reset=crypto.randomUUID(),verify=crypto.randomUUID();
    passwordResetTokens.set(hashToken(reset),{userId:'expired',expiresAt:Date.now()-1});
    emailVerificationTokens.set(verify,{userId:'expired',expiresAt:Date.now()-1});
    expect(await consumePasswordResetToken(reset)).toBeNull();expect(await consumeEmailVerificationToken(verify)).toBeNull();
    expect(passwordResetTokens.has(hashToken(reset))).toBe(false);expect(emailVerificationTokens.has(verify)).toBe(false);
    expect(await consumePasswordResetToken('missing')).toBeNull();
  });
  it('does not restore a claimed link when the account no longer exists', async () => {
    const token=crypto.randomUUID();await setEmailVerificationToken(token,crypto.randomUUID());
    expect((await post('verify-email',{token})).status).toBe(400);expect(await consumeEmailVerificationToken(token)).toBeNull();
  });
});
