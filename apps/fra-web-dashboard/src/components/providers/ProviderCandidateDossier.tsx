import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import type { CandidateProfile } from '@/lib/providerCandidate';
import IndependentEngagementSummary from './IndependentEngagementSummary';
export default function ProviderCandidateDossier({
  base,
  profile,
}: {
  base: string;
  profile?: CandidateProfile | null;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false),
    [error, setError] = useState('');
  const history = useQuery({
    queryKey: ['provider-candidate-revisions', user?.userId, user?.organisationId, base],
    queryFn: () =>
      api.get<
        Array<{
          revision: number;
          companyName: string;
          serviceInterest: string;
          trainingExperience: string | null;
          profile: CandidateProfile | null;
          recordedAt: string;
          event: string;
        }>
      >(`${base}/revisions`),
    enabled: open,
    staleTime: 0,
  });
  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="font-semibold">Candidate information & agreement dossier</h2>
      {profile ? (
        <>
          <p className="text-sm">
            {profile.fullName} · {profile.country} · declared experience:{' '}
            {profile.expertise.join(', ')}
          </p>
          <p className="whitespace-pre-wrap text-sm">{profile.experience}</p>
          <IndependentEngagementSummary value={profile.engagement} />
        </>
      ) : (
        <p className="text-sm">
          No independent declaration recorded. Existing provider applications remain valid under
          their original review policy.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        The preparation dossier is not a contract or approval. Existing qualification checks,
        applicant-only signing and the commission ledger remain unchanged.
      </p>
      <Button
        variant="outline"
        onClick={async () => {
          setError('');
          try {
            await api.download(`${base}/dossier`, 'provider-agreement-dossier.txt');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Download failed');
          }
        }}
      >
        Download agreement preparation dossier
      </Button>
      {error && <p role="alert">{error}</p>}
      <Button variant="outline" onClick={() => setOpen(!open)}>
        {open ? 'Hide candidate revisions' : 'Show candidate revisions'}
      </Button>
      {open && (
        <div>
          {history.isPending ? (
            <p role="status">Loading candidate revisions…</p>
          ) : history.isError ? (
            <p role="alert">{history.error.message}</p>
          ) : (
            <ol className="space-y-3">
              {history.data?.map((h) => (
                <li key={h.revision}>
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Revision {h.revision} · {h.event}
                    </summary>
                    <p>
                      {h.companyName} · {h.serviceInterest}
                    </p>
                    <p className="whitespace-pre-wrap">{h.trainingExperience}</p>
                    <p className="text-xs">
                      Snapshot retained {new Date(h.recordedAt).toLocaleString('en-GB')}
                    </p>
                    <IndependentEngagementSummary value={h.profile?.engagement} />
                  </details>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
