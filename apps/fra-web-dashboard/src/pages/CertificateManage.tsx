import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useConfirm } from '@/hooks/useConfirm';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CertificateManage() {
  const confirm = useConfirm();
  const [number, setNumber] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const revoke = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!number.trim() || !reason.trim()) {
      setError('Enter a certificate number and a reason.');
      return;
    }
    if (
      !(await confirm({
        title: `Revoke ${number.trim()}?`,
        description:
          'The public check will show this certificate as revoked. This action cannot be undone here.',
        confirmLabel: 'Revoke certificate',
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    try {
      const result = await api.post<{ changed: boolean; certificateNumber: string }>(
        `/api/v1/certificates/${encodeURIComponent(number.trim())}/revoke`,
        { reason: reason.trim() }
      );
      setMessage(
        result.changed
          ? `${result.certificateNumber} has been revoked.`
          : `${result.certificateNumber} was already revoked. Its original reason has been preserved.`
      );
      setReason('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'The certificate could not be revoked. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Layout>
      <div className="container max-w-2xl py-10">
        <Card>
          <CardHeader>
            <CardTitle level={1}>Manage certificates</CardTitle>
            <CardDescription>
              Revoke a certificate issued by your organisation. The reason is recorded privately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={revoke} className="space-y-5">
              <div>
                <Label htmlFor="manage-certificate-number">Certificate number</Label>
                <Input
                  id="manage-certificate-number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  required
                  maxLength={80}
                  autoComplete="off"
                  disabled={busy}
                />
              </div>
              <div>
                <Label htmlFor="revocation-reason">Reason for revocation</Label>
                <Textarea
                  id="revocation-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  maxLength={1000}
                  rows={4}
                  disabled={busy}
                />
              </div>
              <Button
                type="submit"
                variant="destructive"
                disabled={busy || !number.trim() || !reason.trim()}
              >
                {busy ? 'Revoking…' : 'Revoke certificate'}
              </Button>
            </form>
            {message && (
              <p role="status" className="mt-5">
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-5 text-destructive">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
