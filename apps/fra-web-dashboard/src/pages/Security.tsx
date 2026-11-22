import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function Security() {
  const { signOut, user } = useAuth();
  const [state, setState] = useState<{ enabled: boolean; required: boolean }>();
  const [password, setPassword] = useState(''),
    [code, setCode] = useState(''),
    [secret, setSecret] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState(''),
    [reason, setReason] = useState('');
  useEffect(() => {
    api
      .get<{ enabled: boolean; required: boolean }>('/api/v1/security/mfa')
      .then(setState)
      .catch((e) => setMessage(e.message));
  }, []);
  useEffect(() => {
    if (!secret) return;
    const timer = window.setTimeout(() => {
      setSecret('');
      setMessage('Setup expired. Start again to create a new authenticator key.');
    }, 600000);
    return () => window.clearTimeout(timer);
  }, [secret]);
  async function enrol() {
    setBusy(true);
    setMessage('');
    try {
      const result = await api.post<{ secret: string }>('/api/v1/security/mfa/enrol', { password });
      setSecret(result.secret);
      setPassword('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      await api.post('/api/v1/security/mfa/confirm', { code });
      setSecret('');
      setCode('');
      setMessage('Authenticator enabled. Sign in again with your password and a fresh code.');
      await signOut();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }
  async function role(action: string) {
    setBusy(true);
    try {
      await api.post('/api/v1/security/roles/finance', { userId, reason, action });
      setMessage('Finance role updated. Changes apply immediately.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Role update failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Layout>
      <main className="container max-w-xl py-10 space-y-5">
        <h1 className="text-2xl font-bold">Account security</h1>
        <p>
          Use an authenticator app with six-digit, 30-second codes. MFA is required for
          administrators, facilitators, operator accounts and finance users.
        </p>
        {message && <p role="status">{message}</p>}
        {state?.enabled ? (
          <p>
            Authenticator enabled. Your code is required at every password login. Finance actions
            require a login within the last 15 minutes.
          </p>
        ) : (
          <>
            <p>
              Enter your current password to start setup. The setup key expires after ten minutes;
              keep it private and never send it to support.
            </p>
            <label>
              Current password
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <Button disabled={busy || !password} onClick={enrol}>
              Set up authenticator
            </Button>
            {secret && (
              <section className="space-y-4">
                <p>
                  In your authenticator app choose “Enter setup key”, account “Fresh FRA”, time
                  based.
                </p>
                <code className="break-all select-all">{secret}</code>
                <label>
                  Authenticator code
                  <Input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
                <Button onClick={confirm} disabled={busy || !/^\d{6}$/.test(code)}>
                  Confirm and sign in again
                </Button>
              </section>
            )}
          </>
        )}
        <p>
          If you lose your authenticator, contact your authorised administrator for identity-checked
          recovery. Email and password reset do not bypass MFA.
        </p>
        {state?.enabled && user?.role === 'admin' && (
          <section className="space-y-3 border-t pt-5">
            <h2 className="text-lg font-semibold">Finance role administration</h2>
            <p>
              Only an operator administrator with recent MFA can assign or revoke this role for
              another verified operator account. This role does not grant recruitment or
              certification authority.
            </p>
            <label>
              User UUID
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
            </label>
            <label>
              Reason
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <Button disabled={busy || reason.length < 10 || !userId} onClick={() => role('grant')}>
              Grant finance role
            </Button>{' '}
            <Button
              variant="outline"
              disabled={busy || reason.length < 10 || !userId}
              onClick={() => role('revoke')}
            >
              Revoke finance role
            </Button>
          </section>
        )}
      </main>
    </Layout>
  );
}
