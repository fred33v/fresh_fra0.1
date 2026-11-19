import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ClipboardCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { api } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ProviderDetails,
  ProviderHistory,
  ProviderStatus,
} from '@/components/providers/ProviderDetails';
import {
  availableReviews,
  providerStatusLabels,
  type ProviderApplication,
  type ProviderStatus as Status,
} from '@/lib/providers';
export default function PartnerReviews() {
  const { id } = useParams(),
    { user } = useAuth(),
    confirm = useConfirm(),
    cache = useQueryClient(),
    navigate = useNavigate();
  const [filter, setFilter] = useState('submitted'),
    [offset, setOffset] = useState(0),
    [decision, setDecision] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const queue = useQuery({
    queryKey: ['provider-reviews', user?.userId, filter, offset],
    queryFn: () =>
      api.get<{ applications: ProviderApplication[]; hasMore: boolean }>(
        `/api/v1/providers/admin/applications?offset=${offset}${filter === 'all' ? '' : `&status=${filter}`}`
      ),
    enabled: !!user && !id,
    staleTime: 0,
  });
  const detail = useQuery({
    queryKey: ['provider-review', user?.userId, id],
    queryFn: () =>
      api.get<{ application: ProviderApplication; canReview: boolean }>(
        `/api/v1/providers/admin/applications/${id}`
      ),
    enabled: !!user && !!id,
    staleTime: 0,
  });
  const application = detail.data?.application;
  useEffect(() => {
    setMessage('');
    setDecision('');
    setError('');
    setNotice('');
  }, [id]);
  useEffect(() => {
    setMessage('');
    setDecision('');
  }, [application?.version]);
  const [engagementReviewed, setEngagementReviewed] = useState(false);
  useEffect(() => setEngagementReviewed(false), [id, application?.version]);
  const options = application
    ? availableReviews[application.status].filter(
        (status) => status !== 'approved' || application.independentEngagementComplete
      )
    : [];
  const save = async () => {
    if (!application || !decision || busy || (decision === 'approved' && !engagementReviewed))
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (
        !(await confirm({
          title: `${providerStatusLabels[decision as Status]}?`,
          description:
            'The applicant will see your message. This decision is retained and does not activate any payout.',
          confirmLabel: 'Record decision',
        }))
      )
        return;
      await api.post(`/api/v1/providers/admin/applications/${application.id}/review`, {
        version: application.version,
        status: decision,
        message: message.trim(),
        engagementReviewed: decision === 'approved' && engagementReviewed,
      });
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['provider-review', user?.userId, id] }),
        cache.invalidateQueries({ queryKey: ['provider-reviews', user?.userId] }),
      ]);
      setNotice('Decision recorded. Payouts remain inactive.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decision could not be recorded.');
    } finally {
      setBusy(false);
    }
  };
  const current = id ? detail : queue;
  return (
    <Layout>
      <div className="container max-w-6xl py-8 sm:py-12">
        <Link
          to={id ? '/partners/review' : '/partners'}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {id ? 'All applications' : 'Partner programme'}
        </Link>
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Administration
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Partner applications</h1>
          </div>
        </div>
        {current.isPending ? (
          <p role="status" className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading applications…
          </p>
        ) : current.isError ? (
          <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-destructive">
            {current.error instanceof Error
              ? current.error.message
              : 'Applications could not be loaded.'}
          </p>
        ) : !id ? (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <Label htmlFor="review-filter">Application status</Label>
                <select
                  id="review-filter"
                  className="ml-3 h-10 rounded-md border bg-background px-3 text-sm"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="all">All statuses</option>
                  {Object.entries(providerStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                disabled={queue.isFetching}
                onClick={() => void queue.refetch()}
              >
                Refresh queue
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="p-4 font-medium">Applicant</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Updated</th>
                    <th className="p-4">
                      <span className="sr-only">Review</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {queue.data?.applications.map((app) => (
                    <tr key={app.id} className="border-b last:border-0">
                      <td className="p-4">
                        <Link
                          to={`/partners/review/${app.id}`}
                          className="font-medium hover:underline"
                        >
                          {app.profile.businessName}
                        </Link>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {app.profile.fullName} · {app.contactEmail}
                        </p>
                      </td>
                      <td className="p-4">
                        <ProviderStatus application={app} />
                      </td>
                      <td className="whitespace-nowrap p-4 text-muted-foreground">
                        {new Date(app.updatedAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Review ${app.profile.businessName}`}
                          onClick={() => navigate(`/partners/review/${app.id}`)}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {queue.data?.applications.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-muted-foreground">
                        No applications with this status.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={offset === 0 || queue.isFetching}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!queue.data?.hasMore || queue.isFetching}
                onClick={() => setOffset(offset + 25)}
              >
                Next
              </Button>
            </div>
          </>
        ) : (
          application && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <section className="rounded-xl border bg-card p-5 sm:p-7">
                  <ProviderDetails application={application} />
                </section>
                <ProviderHistory application={application} />
              </div>
              <aside className="space-y-5">
                <section className="rounded-xl border p-5">
                  <h2 className="font-semibold">Review decision</h2>
                  <p className="my-3 text-sm text-muted-foreground">
                    Review the information supplied. Programme approval is separate from
                    professional checks and Stripe verification.
                  </p>
                  {error && (
                    <p role="alert" className="mb-4 text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  {notice && (
                    <p role="status" className="mb-4 text-sm text-teal-800">
                      {notice}
                    </p>
                  )}
                  {!application.independentEngagementComplete && (
                    <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                      The independent engagement forms are missing or incomplete. Request an updated
                      application before approval. Existing history remains retained.
                    </p>
                  )}
                  {!detail.data?.canReview ? (
                    <p className="text-sm text-amber-800">
                      Another administrator must review your own application.
                    </p>
                  ) : options.length ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void save();
                      }}
                    >
                      <fieldset disabled={busy} className="space-y-4">
                        <div>
                          <Label htmlFor="review-decision">Decision</Label>
                          <select
                            id="review-decision"
                            className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"
                            value={decision}
                            onChange={(e) => {
                              setDecision(e.target.value);
                              setEngagementReviewed(false);
                            }}
                            required
                          >
                            <option value="">Choose a decision</option>
                            {options.map((status) => (
                              <option key={status} value={status}>
                                {providerStatusLabels[status]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="review-message">Message to the applicant</Label>
                          <Textarea
                            id="review-message"
                            className="mt-1"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            minLength={3}
                            maxLength={2000}
                            required
                            rows={5}
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Visible to the applicant and retained in the history.
                          </p>
                        </div>
                        {decision === 'approved' && (
                          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={engagementReviewed}
                              onChange={(e) => setEngagementReviewed(e.target.checked)}
                              required
                            />
                            <span>
                              I have reviewed the candidate's independent engagement information.
                              Programme approval does not execute a contract or replace an
                              employment/tax status assessment.
                            </span>
                          </label>
                        )}
                        <Button
                          className="w-full"
                          disabled={
                            busy ||
                            !decision ||
                            message.trim().length < 3 ||
                            (decision === 'approved' && !engagementReviewed)
                          }
                        >
                          {busy ? 'Recording…' : 'Record decision'}
                        </Button>
                      </fieldset>
                    </form>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      The applicant can update their details and resubmit for another review.
                    </p>
                  )}
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    disabled={busy}
                    onClick={() => void detail.refetch()}
                  >
                    Refresh application
                  </Button>
                </section>
                <section className="rounded-xl bg-slate-950 p-5 text-sm leading-relaxed text-slate-300">
                  <h2 className="mb-2 font-semibold text-white">
                    17% of referred package sales, excluding VAT
                  </h2>
                  <p>
                    Approval does not activate payouts or verify a recipient's identity. Stripe
                    onboarding, attribution, refunds and transfer controls are the next increment.
                  </p>
                </section>
              </aside>
            </div>
          )
        )}
      </div>
    </Layout>
  );
}
