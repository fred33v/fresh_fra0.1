import ProviderAgreementPanel from '@/components/providers/ProviderAgreementPanel';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Handshake,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import IndependentEngagementForm from '@/components/providers/IndependentEngagementForm';
import { ProviderDetails, ProviderHistory } from '@/components/providers/ProviderDetails';
import {
  emptyProviderProfile,
  independentForm,
  independentDeclarationsReady,
  providerExpertiseLabels,
  providerKindLabels,
  type ProviderApplication,
  type ProviderProfile,
} from '@/lib/providers';

export default function Partners() {
  const { user } = useAuth(),
    cache = useQueryClient();
  const query = useQuery({
    queryKey: ['provider-application', user?.userId],
    queryFn: () =>
      api.get<{
        application: ProviderApplication | null;
        policy: {
          commissionBasisPoints: number;
          termsVersion: string;
          payoutsActive: boolean;
          canReview: boolean;
        };
      }>('/api/v1/providers/me'),
    enabled: !!user,
    staleTime: 0,
  });
  const application = query.data?.application;
  const [profile, setProfile] = useState<ProviderProfile>(() =>
    independentForm(emptyProviderProfile)
  );
  const [acknowledged, setAcknowledged] = useState(false),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    setProfile(independentForm(application?.profile ?? emptyProviderProfile));
    setAcknowledged(false);
  }, [application]);
  const change = <K extends keyof ProviderProfile>(key: K, value: ProviderProfile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));
  const editable = !application || ['submitted', 'rejected'].includes(application.status);
  const submit = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/api/v1/providers/me', {
        version: application?.version ?? 0,
        profile,
        acknowledged,
      });
      await cache.invalidateQueries({ queryKey: ['provider-application', user?.userId] });
      setEditing(false);
      setNotice('Your application has been submitted. You can follow its review here.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your application could not be submitted.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Layout>
      <div className="container max-w-6xl py-8 sm:py-12">
        <Link
          to="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Your dashboard
        </Link>
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Handshake className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Partner with us</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Bring your expertise. Help organisations prevent fraud.
              </p>
            </div>
          </div>
          {query.data?.policy.canReview && (
            <Button variant="outline" asChild>
              <Link to="/partners/review">Review applications</Link>
            </Button>
          )}
        </div>
        <div className="mb-8 rounded-xl bg-slate-950 p-6 text-white sm:p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-teal-300">
            Professional & referral programme
          </p>
          <h2 className="text-2xl font-medium">Build stronger prevention, together.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
            Apply as an independent professional, a package referrer, or both, with no guaranteed
            minimum work or income. Applications are reviewed by our team before programme approval.
          </p>
          <p className="mt-4 max-w-2xl border-t border-white/15 pt-4 text-sm text-slate-200">
            The provider or referrer receives{' '}
            <strong className="text-white">
              17% of the VAT-exclusive package sales they bring
            </strong>
            , subject to attribution, refunds, disputes and recipient verification. This is a
            referral commission, not a fee on your professional services.
          </p>
        </div>
        {query.isPending ? (
          <p role="status" className="flex items-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading your application…
          </p>
        ) : query.isError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 p-5 text-destructive"
          >
            {query.error instanceof Error ? query.error.message : 'Applications are unavailable.'}
            <Button variant="outline" className="ml-3" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
            <div className="space-y-6">
              {notice && (
                <p
                  role="status"
                  className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950"
                >
                  {notice}
                </p>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              {application && !editing ? (
                <section className="rounded-xl border bg-card p-5 sm:p-7">
                  <ProviderDetails application={application} />
                  <div className="mt-6 flex flex-wrap gap-3">
                    {editable && (
                      <Button
                        onClick={() => {
                          setProfile(independentForm(application.profile));
                          setAcknowledged(false);
                          setEditing(true);
                          setError('');
                        }}
                      >
                        Update & resubmit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      disabled={query.isFetching}
                      onClick={() => void query.refetch()}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh status
                    </Button>
                  </div>
                </section>
              ) : (
                <section className="rounded-xl border bg-card p-5 sm:p-7">
                  <h2 className="mb-2 text-xl font-semibold">
                    {application ? 'Update your application' : 'Tell us about yourself'}
                  </h2>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Your verified account email, {user?.email}, will be used for this application.
                    Do not include bank details, identity documents or passwords.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submit();
                    }}
                  >
                    <fieldset disabled={busy} className="space-y-5">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="partner-name">Full name</Label>
                          <Input
                            id="partner-name"
                            className="mt-1"
                            value={profile.fullName}
                            onChange={(e) => change('fullName', e.target.value)}
                            minLength={2}
                            maxLength={120}
                            required
                            autoComplete="name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="partner-business">Business or professional name</Label>
                          <Input
                            id="partner-business"
                            className="mt-1"
                            value={profile.businessName}
                            onChange={(e) => change('businessName', e.target.value)}
                            minLength={2}
                            maxLength={160}
                            required
                            autoComplete="organization"
                          />
                        </div>
                        <div>
                          <Label htmlFor="partner-kind">I would like to contribute</Label>
                          <select
                            id="partner-kind"
                            className="mt-1 h-10 w-full rounded-md border bg-background px-2"
                            value={profile.kind}
                            onChange={(e) =>
                              change('kind', e.target.value as ProviderProfile['kind'])
                            }
                          >
                            {Object.entries(providerKindLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="partner-country">Country code</Label>
                          <Input
                            id="partner-country"
                            className="mt-1 uppercase"
                            value={profile.country}
                            onChange={(e) => change('country', e.target.value.toUpperCase())}
                            maxLength={2}
                            minLength={2}
                            pattern="[A-Z]{2}"
                            placeholder="GB"
                            required
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Two letters, e.g. GB, FR or IE.
                          </p>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="partner-website">Website (optional)</Label>
                        <Input
                          id="partner-website"
                          className="mt-1"
                          type="url"
                          pattern="https://.*"
                          placeholder="https://"
                          value={profile.website}
                          onChange={(e) => change('website', e.target.value)}
                          maxLength={2048}
                        />
                      </div>
                      <fieldset>
                        <legend className="mb-2 text-sm font-medium">
                          Areas you work in or refer clients to
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {Object.entries(providerExpertiseLabels).map(([value, label]) => (
                            <label
                              key={value}
                              className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={profile.expertise.includes(value)}
                                onChange={(e) =>
                                  change(
                                    'expertise',
                                    e.target.checked
                                      ? [...profile.expertise, value]
                                      : profile.expertise.filter((item) => item !== value)
                                  )
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div>
                        <Label htmlFor="partner-experience">
                          Experience and proposed contribution
                        </Label>
                        <Textarea
                          id="partner-experience"
                          className="mt-1"
                          rows={5}
                          value={profile.experience}
                          onChange={(e) => change('experience', e.target.value)}
                          minLength={30}
                          maxLength={3000}
                          required
                          placeholder="Describe your experience, the organisations you support and how you plan to contribute."
                        />
                        <p className="mt-1 text-xs text-muted-foreground">30–3,000 characters.</p>
                      </div>
                      {profile.engagement && (
                        <IndependentEngagementForm
                          value={profile.engagement}
                          onChange={(engagement) => change('engagement', engagement)}
                          country={profile.country}
                        />
                      )}
                      <label className="flex items-start gap-3 rounded-lg bg-muted/30 p-4 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={acknowledged}
                          onChange={(e) => setAcknowledged(e.target.checked)}
                          required
                        />
                        <span>
                          I confirm these details are accurate, have read the 17% referral
                          commission policy above, and understand that application approval does not
                          activate payouts. My application and review history will be retained.
                        </span>
                      </label>
                      <div className="flex flex-wrap justify-end gap-3">
                        {application && (
                          <Button
                            variant="outline"
                            type="button"
                            onClick={() => {
                              setEditing(false);
                              setProfile(application.profile);
                              setAcknowledged(false);
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          disabled={
                            busy ||
                            !acknowledged ||
                            !profile.expertise.length ||
                            !independentDeclarationsReady(profile)
                          }
                        >
                          {busy
                            ? 'Submitting…'
                            : application
                              ? 'Resubmit application'
                              : 'Submit application'}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </fieldset>
                  </form>
                </section>
              )}
              {application && <ProviderAgreementPanel application={application} />}
              {application && <ProviderHistory application={application} />}
            </div>
            <aside className="space-y-5">
              <section className="rounded-xl border p-5">
                <h2 className="mb-5 font-semibold">How it works</h2>
                <ol className="space-y-5 text-sm">
                  <li className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-teal-700" />
                    <div>
                      <p className="font-medium">1. Send your application</p>
                      <p className="mt-1 text-muted-foreground">
                        Use your verified account and tell us how you can contribute.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <FileCheck2 className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">2. Follow the review</p>
                      <p className="mt-1 text-muted-foreground">
                        See the team's decision and any requested changes here.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium">3. Review and sign the agreement</p>
                      <p className="mt-1 text-muted-foreground">
                        After approval, review the proposed agreement and sign through the emailed
                        invitation. Both parties must sign before administrative validation.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <FileCheck2 className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">4. Follow administrative validation</p>
                      <p className="mt-1 text-muted-foreground">
                        Track the signed agreement and the team's final readiness review here.
                        Stripe recipient verification and payouts come afterwards and remain
                        inactive.
                      </p>
                    </div>
                  </li>
                </ol>
              </section>
              <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                Programme approval is an administrative decision. It does not verify professional
                qualifications, create an advanced/qualified signing identity, or activate payment
                transfers.
              </p>
            </aside>
          </div>
        )}
      </div>
    </Layout>
  );
}
