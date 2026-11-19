import IndependentEngagementSummary from './IndependentEngagementSummary';
import { Badge } from '@/components/ui/badge';
import {
  providerStatusLabels,
  providerKindLabels,
  providerExpertiseLabels,
  type ProviderApplication,
} from '@/lib/providers';
export function ProviderStatus({ application }: { application: ProviderApplication }) {
  return (
    <Badge
      variant="outline"
      className={
        application.status === 'approved'
          ? 'border-teal-300 bg-teal-50 text-teal-950'
          : application.status === 'rejected' || application.status === 'suspended'
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : 'bg-muted'
      }
    >
      {providerStatusLabels[application.status]}
    </Badge>
  );
}
export function ProviderDetails({ application }: { application: ProviderApplication }) {
  const profile = application.profile;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{profile.businessName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.fullName} · {profile.country}
          </p>
        </div>
        <ProviderStatus application={application} />
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Verified email at submission</dt>
          <dd className="mt-1 break-all font-medium">{application.contactEmail}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Programme</dt>
          <dd className="mt-1 font-medium">{providerKindLabels[profile.kind]}</dd>
        </div>
        {profile.website && (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Website</dt>
            <dd className="mt-1 break-all">{profile.website}</dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap gap-2">
        {profile.expertise.map((area) => (
          <Badge key={area} variant="secondary">
            {providerExpertiseLabels[area] ?? area}
          </Badge>
        ))}
      </div>
      <div>
        <h3 className="text-sm font-semibold">Experience and proposed contribution</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {profile.experience}
        </p>
      </div>
      <IndependentEngagementSummary value={profile.engagement} />
      {application.reviewMessage && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold">Message from the review team</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">
            {application.reviewMessage}
          </p>
        </div>
      )}
      <p className="border-t pt-4 text-xs text-muted-foreground">
        Revision {application.version} · Submitted{' '}
        {new Date(application.submittedAt).toLocaleDateString('en-GB')} · Updated{' '}
        {new Date(application.updatedAt).toLocaleDateString('en-GB')}
      </p>
    </div>
  );
}
export function ProviderHistory({ application }: { application: ProviderApplication }) {
  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="mb-4 font-semibold">Application history</h2>
      <ol className="space-y-4">
        {application.history?.map((entry) => (
          <li key={entry.id} className="border-l-2 border-teal-200 pl-4">
            <p className="text-sm font-medium">
              {providerStatusLabels[entry.status]} · Revision {entry.version}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(entry.createdAt).toLocaleString('en-GB')} ·{' '}
              {['application.submitted', 'application.resubmitted'].includes(entry.event)
                ? 'Applicant'
                : 'Review team'}
            </p>
            {entry.message && (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{entry.message}</p>
            )}
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-primary underline underline-offset-2">
                Details recorded at this revision
              </summary>
              <div className="mt-3 space-y-2 rounded-lg bg-muted/30 p-3">
                <p>
                  {entry.profile.fullName} · {entry.profile.businessName} · {entry.profile.country}
                </p>
                <p className="break-all">{entry.contactEmail}</p>
                <p>{providerKindLabels[entry.profile.kind]}</p>
                <p>
                  {entry.profile.expertise
                    .map((area) => providerExpertiseLabels[area] ?? area)
                    .join(', ')}
                </p>
                {entry.profile.website && <p className="break-all">{entry.profile.website}</p>}
                <p className="whitespace-pre-wrap break-words">{entry.profile.experience}</p>
                <IndependentEngagementSummary value={entry.profile.engagement} />
                {entry.engagementReviewed && (
                  <p>Independent engagement information reviewed ({entry.engagementVersion}).</p>
                )}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
