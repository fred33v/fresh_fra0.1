import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, SearchCheck, XCircle } from 'lucide-react';
import { anonymousApi, ApiError } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { VerifiedCertificate } from '@/types/workshop';

type Result =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'valid'; certificate: VerifiedCertificate }
  | { state: 'revoked'; number: string }
  | { state: 'invalid'; message: string };

const longDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function failureMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'NOT_FOUND') return 'No certificate has this number. Check it against the certificate, or ask the holder for a copy.';
    if (err.code === 'INVALID_NUMBER') return 'That is not a certificate number. They look like FRA-1A2B-3C4D-5E6F.';
    if (err.code === 'RATE_LIMITED') return 'Too many checks from your connection. Please wait a minute and try again.';
  }
  return 'We could not check the certificate just now. Please try again.';
}

/**
 * Public page (no sign-in): anyone holding a certificate, such as an auditor or a funder,
 * can check it is genuine. The QR code on each certificate opens this page with ?n=<number>.
 */
export default function CertificateVerify() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromLink = searchParams.get('n') ?? '';
  const [number, setNumber] = useState(fromLink);
  const [result, setResult] = useState<Result>({ state: 'idle' });
  const requestSequence = useRef(0);

  const check = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const request = ++requestSequence.current;
    setResult({ state: 'checking' });
    try {
      const certificate = await anonymousApi.get<VerifiedCertificate>(`/api/v1/certificates/verify/${encodeURIComponent(trimmed)}`);
      if (request !== requestSequence.current) return;
      if (certificate.status === 'revoked') setResult({ state: 'revoked', number: certificate.certificateNumber });
      else if (certificate.valid === true) setResult({ state: 'valid', certificate });
      else setResult({ state: 'invalid', message: 'This certificate could not be verified.' });
    } catch (err: unknown) {
      if (request === requestSequence.current) setResult({ state: 'invalid', message: failureMessage(err) });
    }
  };

  useEffect(() => {
    if (fromLink) check(fromLink);
    // This is a sequence counter, not a DOM ref: cleanup invalidates pending checks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { requestSequence.current++; };
    // Check once for the number in the link; later checks come from the form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSearchParams(number.trim() ? { n: number.trim() } : {}, { replace: true });
    check(number);
  };

  return (
    <Layout>
      <div className="container max-w-2xl py-10 lg:py-16">
        <div className="text-center mb-8">
          <SearchCheck className="h-10 w-10 text-primary mx-auto mb-3" aria-hidden="true" />
          <h1 className="text-3xl font-bold mb-2">Verify a certificate</h1>
          <p className="text-muted-foreground">
            Check that a FRAUD-RISK.CO.UK training or risk assessment certificate is genuine.
            Enter the number printed on it, or scan its QR code.
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <Label htmlFor="certificate-number">Certificate number</Label>
                <Input
                  id="certificate-number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="FRA-1A2B-3C4D-5E6F"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono mt-1"
                />
              </div>
              <Button type="submit" disabled={!number.trim() || result.state === 'checking'}>
                {result.state === 'checking' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Check
              </Button>
            </form>
          </CardContent>
        </Card>

        <div aria-live="polite">
          {result.state === 'valid' && (
            <Card className="border-success">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-success" level={2}>
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                  Certificate is valid
                </CardTitle>
                <CardDescription>
                  {result.certificate.snapshotOrigin === 'legacy_reconstructed'
                    ? 'Legacy record: these details were reconstructed from existing records and may differ from the original certificate.'
                    : 'These are the details recorded when this certificate was issued. They should match the certificate exactly.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid sm:grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">
                    {result.certificate.kind === 'training' ? 'Fraud risk awareness training' : 'Fraud risk assessment'}
                  </dd>
                  <dt className="text-muted-foreground">
                    {result.certificate.kind === 'training' ? 'Awarded to' : 'Organisation'}
                  </dt>
                  <dd className="font-medium">{result.certificate.holderName}</dd>
                  {result.certificate.kind === 'training' && result.certificate.organisationName && (
                    <>
                      <dt className="text-muted-foreground">Organisation</dt>
                      <dd className="font-medium">{result.certificate.organisationName}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">
                    {result.certificate.kind === 'training' ? 'Course' : 'Assessment'}
                  </dt>
                  <dd className="font-medium">
                    {result.certificate.title}
                    {result.certificate.areasAssessed !== null && ` (${result.certificate.areasAssessed} risk areas)`}
                  </dd>
                  {result.certificate.quizScore !== null && (
                    <>
                      <dt className="text-muted-foreground">Quiz score</dt>
                      <dd className="font-medium">{result.certificate.quizScore}%</dd>
                    </>
                  )}
                  {result.certificate.completedAt && <><dt className="text-muted-foreground">Date completed</dt>
                    <dd className="font-medium">{longDate(result.certificate.completedAt)}</dd></>}
                  <dt className="text-muted-foreground">Date issued</dt>
                  <dd className="font-medium">{longDate(result.certificate.issuedAt)}</dd>
                  <dt className="text-muted-foreground">Number</dt>
                  <dd className="font-mono font-medium">{result.certificate.certificateNumber}</dd>
                </dl>
              </CardContent>
            </Card>
          )}

          {result.state === 'revoked' && (
            <Card className="border-destructive"><CardContent className="pt-6 flex gap-3">
              <XCircle className="h-6 w-6 text-destructive flex-none" aria-hidden="true" />
              <div><h2 className="font-semibold mb-1">Certificate has been revoked</h2>
                <p className="font-mono">{result.number}</p>
                <p className="text-muted-foreground">This certificate is no longer valid. Contact the issuing organisation if you need further information.</p></div>
            </CardContent></Card>
          )}

          {result.state === 'invalid' && (
            <Card className="border-destructive">
              <CardContent className="pt-6 flex gap-3">
                <XCircle className="h-6 w-6 text-destructive flex-none" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold mb-1">Not verified</h2>
                  <p className="text-muted-foreground">{result.message}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
