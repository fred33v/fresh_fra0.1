import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ProviderApplication } from '@/lib/providers';
import {
  agreementStateLabels,
  agreementTermFields,
  emptyAgreementTerms,
  type AgreementTerms,
  type ProviderAgreement,
} from '@/lib/providerAgreements';

export default function ProviderAgreementPanel({
  application,
  administrator = false,
}: {
  application: ProviderApplication;
  administrator?: boolean;
}) {
  const { user } = useAuth(),
    cache = useQueryClient(),
    confirm = useConfirm();
  const [editing, setEditing] = useState(false),
    [terms, setTerms] = useState<AgreementTerms>({ ...emptyAgreementTerms });
  const [termsReviewed, setTermsReviewed] = useState(false),
    [statusReviewed, setStatusReviewed] = useState(false);
  const [contractReviewed, setContractReviewed] = useState(false),
    [readyStatusReviewed, setReadyStatusReviewed] = useState(false);
  const [reviewNote, setReviewNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const path = `/api/v1/providers/admin/applications/${application.id}`;
  const review = useQuery({
    queryKey: ['provider-agreements', user?.userId, application.id, application.version],
    queryFn: () =>
      api.get<{
        agreements: ProviderAgreement[];
        canPrepare: boolean;
        manageableDocumentIds: string[];
      }>(`${path}/agreements`),
    enabled: administrator && !!user,
    staleTime: 0,
  });
  const agreements = administrator ? review.data?.agreements : application.agreements;
  const current = agreements?.[0];
  useEffect(() => {
    setEditing(false);
    setError('');
    setTermsReviewed(false);
    setStatusReviewed(false);
    setContractReviewed(false);
    setReadyStatusReviewed(false);
    setReviewNote('');
  }, [application.id, application.version, current?.id]);
  // The success notice is set after the refetch that a prepare or readiness action triggers, and that refetch
  // changes `current?.id`. Clearing it on that change raced with setNotice and lost the message on slower
  // machines, so it is cleared only when a different application or revision is shown.
  useEffect(() => {
    setNotice('');
  }, [application.id, application.version]);
  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['provider-agreements', user?.userId, application.id] }),
      cache.invalidateQueries({ queryKey: ['provider-review', user?.userId, application.id] }),
      cache.invalidateQueries({ queryKey: ['provider-reviews', user?.userId] }),
      cache.invalidateQueries({ queryKey: ['provider-application', user?.userId] }),
    ]);
  };
  const prepare = async () => {
    if (busy || !termsReviewed || !statusReviewed) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (
        !(await confirm({
          title: 'Prepare this agreement?',
          description:
            'The terms and candidate revision will be retained. Both parties must review the PDF before signing. No email is sent by this step.',
          confirmLabel: 'Prepare agreement',
        }))
      )
        return;
      await api.post(`${path}/agreements`, {
        version: application.version,
        previousAgreementId: current?.id ?? null,
        terms,
        termsReviewed,
        statusReviewed,
      });
      setEditing(false);
      await refresh();
      setNotice(
        'Agreement prepared. Review the PDF and signature fields in Documents & signing before sending.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Agreement could not be prepared.');
    } finally {
      setBusy(false);
    }
  };
  const ready = async () => {
    if (!current || busy || !contractReviewed || !readyStatusReviewed) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (
        !(await confirm({
          title: 'Record engagement readiness?',
          description:
            'The server will verify the retained PDF and evidence protection. Your review is retained. Payouts remain inactive.',
          confirmLabel: 'Verify and record readiness',
        }))
      )
        return;
      await api.post(`${path}/engagement-ready`, {
        version: application.version,
        agreementId: current.id,
        reviewNote,
        contractReviewed,
        statusReviewed: readyStatusReviewed,
      });
      await refresh();
      setNotice('Administrative readiness recorded. Payouts remain inactive.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Readiness could not be verified.');
    } finally {
      setBusy(false);
    }
  };
  const downloadable = async (g: ProviderAgreement) => {
    setError('');
    try {
      await api.download(
        administrator
          ? `${path}/agreements/${g.id}/final`
          : `/api/v1/providers/me/agreements/${g.id}/final`,
        'signed-services-agreement.pdf'
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'The retained PDF could not be verified or downloaded.'
      );
    }
  };
  const canPrepare =
    administrator &&
    review.data?.canPrepare &&
    application.status === 'approved' &&
    application.independentEngagementComplete &&
    (!current ||
      !current.matchingRevision ||
      (current.documentStatus !== 'completed' &&
        (current.documentStatus !== 'sent' || current.expired)));
  return (
    <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-7">
      <div>
        <h2 className="text-lg font-semibold">Agreement & administrative follow-up</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Programme approval, signatures and administrative readiness are separate steps. The
          independent arrangement has no guaranteed minimum work or income; referral commission
          remains 17% of VAT-exclusive package sales brought. Payouts remain inactive.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-teal-800">
          {notice}
        </p>
      )}
      {administrator && review.isPending ? (
        <p role="status">Loading agreement follow-up…</p>
      ) : administrator && review.isError ? (
        <div role="alert">
          <p>Agreement follow-up could not be loaded.</p>
          <Button variant="outline" onClick={() => void review.refetch()}>
            Retry agreement follow-up
          </Button>
        </div>
      ) : (
        <>
          {!current ? (
            <p className="text-sm">
              No linked agreement yet.{' '}
              {application.status === 'approved'
                ? 'The review team can now prepare the terms.'
                : 'Complete candidate review before preparing the agreement.'}
            </p>
          ) : (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold">{agreementStateLabels[current.state]}</h3>
              <p className="text-sm text-muted-foreground">
                Candidate revision {current.applicationVersion} · {current.signedCount}/
                {current.signerCount} signatures recorded
              </p>
              {current.readyAt && (
                <p className="text-sm">
                  Readiness review recorded {new Date(current.readyAt).toLocaleString('en-GB')}.
                  {!current.ready &&
                    ' This earlier review does not make the current engagement ready.'}
                </p>
              )}
              {current.reviewNote && (
                <p className="whitespace-pre-wrap break-words text-sm">{current.reviewNote}</p>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">
                  Terms recorded for this agreement
                </summary>
                <dl className="mt-3 space-y-3">
                  {agreementTermFields.map((f) => (
                    <div key={f.key}>
                      <dt className="font-medium">{f.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-muted-foreground">
                        {current.terms[f.key]}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 break-all text-xs">
                  Prepared PDF SHA-256: {current.sourceSha256}
                </p>
              </details>
              {administrator && review.data?.manageableDocumentIds.includes(current.documentId) && (
                <Button variant="outline" asChild>
                  <Link to={`/signing/${current.documentId}`}>
                    Open agreement in Documents & signing
                  </Link>
                </Button>
              )}
              {current.documentStatus === 'completed' && (
                <Button variant="outline" onClick={() => void downloadable(current)}>
                  Download verified signed agreement
                </Button>
              )}
            </div>
          )}
          {canPrepare && !editing && (
            <Button
              onClick={() => {
                setTerms({ ...emptyAgreementTerms, ...current?.terms });
                setTermsReviewed(false);
                setStatusReviewed(false);
                setEditing(true);
              }}
            >
              {' '}
              {current ? 'Prepare a retained replacement' : 'Prepare services agreement'}
            </Button>
          )}
          {editing && canPrepare && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void prepare();
              }}
            >
              <fieldset disabled={busy} className="space-y-4">
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                  Supply reviewed terms for this engagement. The application does not determine
                  employment/tax status. Use printable Latin characters for the generated PDF. Your
                  review summary is visible to the candidate. Replacement agreements retain earlier
                  records.
                </p>
                {agreementTermFields.map((f) => (
                  <div key={f.key}>
                    <Label htmlFor={`agreement-${f.key}`}>{f.label}</Label>
                    {f.short ? (
                      <Input
                        className="mt-1"
                        id={`agreement-${f.key}`}
                        type={f.key === 'signatoryEmail' ? 'email' : 'text'}
                        required
                        minLength={f.key === 'signatoryEmail' ? 3 : 2}
                        maxLength={f.max}
                        value={terms[f.key]}
                        onChange={(e) => setTerms({ ...terms, [f.key]: e.target.value })}
                      />
                    ) : (
                      <Textarea
                        className="mt-1"
                        id={`agreement-${f.key}`}
                        required
                        minLength={10}
                        maxLength={f.max}
                        rows={4}
                        value={terms[f.key]}
                        onChange={(e) => setTerms({ ...terms, [f.key]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    required
                    checked={termsReviewed}
                    onChange={(e) => setTermsReviewed(e.target.checked)}
                  />
                  <span>
                    I have reviewed the proposed contract terms and the organisation signatory's
                    authority.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    required
                    checked={statusReviewed}
                    onChange={(e) => setStatusReviewed(e.target.checked)}
                  />
                  <span>
                    I have reviewed the actual working arrangements and applicable
                    employment-rights/tax status for this engagement.
                  </span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button disabled={busy || !termsReviewed || !statusReviewed}>
                    {busy ? 'Preparing…' : 'Prepare agreement PDF'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Cancel preparation
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          {administrator &&
            review.data?.canPrepare &&
            current?.state === 'signed_pending_review' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void ready();
                }}
              >
                <fieldset disabled={busy} className="space-y-4 rounded-lg border p-4">
                  <h3 className="font-semibold">Final administrative review</h3>
                  <Label htmlFor="agreement-ready-note">
                    Readiness review note (visible to candidate)
                  </Label>
                  <Textarea
                    id="agreement-ready-note"
                    required
                    minLength={10}
                    maxLength={2000}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                  />
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      required
                      checked={contractReviewed}
                      onChange={(e) => setContractReviewed(e.target.checked)}
                    />
                    <span>I have reviewed the completed agreement signed by both parties.</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      required
                      checked={readyStatusReviewed}
                      onChange={(e) => setReadyStatusReviewed(e.target.checked)}
                    />
                    <span>
                      I confirm the engagement arrangements and applicable status review are
                      complete.
                    </span>
                  </label>
                  <Button
                    disabled={
                      busy ||
                      !contractReviewed ||
                      !readyStatusReviewed ||
                      reviewNote.trim().length < 10
                    }
                  >
                    {busy
                      ? 'Verifying retained evidence…'
                      : 'Verify evidence & record engagement ready'}
                  </Button>
                </fieldset>
              </form>
            )}
          {!!agreements && agreements.length > 1 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                Previous agreements retained
              </summary>
              <ul className="mt-3 space-y-3 text-sm">
                {agreements.slice(1).map((g) => (
                  <li key={g.id} className="rounded border p-3">
                    Revision {g.applicationVersion} · {g.documentStatus} ·{' '}
                    {new Date(g.createdAt).toLocaleDateString('en-GB')}
                    {g.documentStatus === 'completed' && (
                      <Button variant="link" onClick={() => void downloadable(g)}>
                        Download previous signed agreement
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <Button variant="outline" disabled={busy} onClick={() => void refresh()}>
            Refresh agreement status
          </Button>
        </>
      )}
    </section>
  );
}
