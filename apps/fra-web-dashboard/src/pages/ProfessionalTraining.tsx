import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ProfessionalScope } from '@/lib/professional';
const base = '/api/v1/professional';
type Session = {
  id: string;
  scopeId: string;
  scopeRevision: number;
  code: string;
  title: string;
  snapshot: { subjectTitle: string; subjectVersion: string };
};
type Learner = {
  id: string;
  name: string;
  completedAt: string | null;
  quizPercent: number;
  missing: { sections: number[]; quizzes: number[] };
  assessmentRevision: number;
  decision: string | null;
};
export default function ProfessionalTraining() {
  const { user } = useAuth(),
    cache = useQueryClient();
  const [assignment, setAssignment] = useState(''),
    [title, setTitle] = useState(''),
    [selected, setSelected] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const own = useQuery({
    queryKey: ['professional-training-assignments', user?.userId, user?.organisationId],
    queryFn: () =>
      api.get<
        Array<{
          id: string;
          reference: string;
          service: string;
          status: string;
          scopeId: string | null;
          scopeRevision: number | null;
        }>
      >('/api/v1/provider-applications/me/assignments'),
  });
  const scopes = useQuery({
    queryKey: ['professional-training-scopes', user?.userId, user?.organisationId],
    queryFn: () => api.get<ProfessionalScope[]>(`${base}/me/scopes`),
    refetchInterval: 30000,
  });
  const sessions = useQuery({
    queryKey: ['professional-sessions', user?.userId, user?.organisationId],
    queryFn: () => api.get<Session[]>(`${base}/me/sessions`),
  });
  const roster = useQuery({
    queryKey: ['professional-roster', user?.userId, user?.organisationId, selected],
    queryFn: () => api.get<Learner[]>(`${base}/sessions/${selected}/participants`),
    enabled: !!selected,
    refetchInterval: selected ? 30000 : false,
  });
  const offers = (own.data ?? []).filter(
    (a) =>
      a.service === 'training' &&
      a.status === 'accepted' &&
      a.scopeId &&
      scopes.data?.some((s) => s.id === a.scopeId && s.effective && s.revision === a.scopeRevision)
  );
  const chosen = offers.find((a) => a.id === assignment) ?? offers[0];
  const session = sessions.data?.find((s) => s.id === selected);
  const rights =
    scopes.data?.find(
      (s) => s.id === session?.scopeId && s.revision === session?.scopeRevision && s.effective
    )?.actions ?? [];
  const create = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    setError('');
    try {
      const s = await api.post<{ id: string }>(`${base}/sessions`, {
        scopeId: chosen.scopeId,
        scopeRevision: chosen.scopeRevision,
        assignmentId: chosen.id,
        title,
      });
      await cache.invalidateQueries({
        queryKey: ['professional-sessions', user?.userId, user?.organisationId],
      });
      setSelected(s.id);
      setTitle('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Session could not be created');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Layout>
      <main className="container max-w-4xl space-y-6 py-10">
        <Link to="/provider-application" className="underline">
          Back to provider application
        </Link>
        <h1 className="text-2xl font-bold">Professional training console</h1>
        <p>
          Use the approved course and your reviewed materials. Learners join the existing Workshop
          with the session code. Completion certificates remain learner records, not professional
          accreditation.
        </p>
        {(own.isError || scopes.isError || sessions.isError) && (
          <p role="alert">
            {own.error?.message ?? scopes.error?.message ?? sessions.error?.message}
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="space-y-3 rounded border p-4"
        >
          <h2 className="font-semibold">Start an authorised class</h2>
          <Label htmlFor="professional-assignment">Accepted subject-scoped assignment</Label>
          <select
            id="professional-assignment"
            className="block w-full rounded border bg-background p-2"
            value={chosen?.id ?? ''}
            onChange={(e) => setAssignment(e.target.value)}
            required
          >
            <option value="" disabled>
              Choose an accepted scoped assignment
            </option>
            {offers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.reference}
              </option>
            ))}
          </select>
          <Label htmlFor="professional-class-title">Class title</Label>
          <Input
            id="professional-class-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
            maxLength={200}
          />
          <Button disabled={busy || !chosen}>
            {busy ? 'Creating…' : 'Create scoped training session'}
          </Button>
        </form>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your professional sessions</h2>
          {sessions.isPending ? (
            <p role="status">Loading sessions…</p>
          ) : sessions.data?.length === 0 ? (
            <p>No professional sessions yet.</p>
          ) : (
            sessions.data?.map((s) => (
              <article key={s.id} className="space-y-2 rounded border p-3">
                <h3>
                  {s.title} · {s.snapshot.subjectTitle}
                </h3>
                <p>
                  Subject version {s.snapshot.subjectVersion} · join code{' '}
                  {s.code ?? 'Session retained'}
                </p>
                {s.code && (
                  <Link
                    className="underline"
                    to={`/workshop?session=${encodeURIComponent(s.code)}`}
                  >
                    Learner workshop link
                  </Link>
                )}
                <Button variant="outline" onClick={() => setSelected(s.id)}>
                  View attendance & completion
                </Button>
              </article>
            ))
          )}
        </section>
        {selected && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Attendance and completion review</h2>
            {roster.isError ? (
              <p role="alert">{roster.error.message}</p>
            ) : roster.isPending ? (
              <p role="status">Loading learners…</p>
            ) : (
              roster.data?.map((l) => (
                <LearnerReview
                  key={`${selected}:${l.id}:${l.assessmentRevision}`}
                  learner={l}
                  sessionId={selected}
                  canAssess={rights.includes('assess')}
                  canIssue={rights.includes('issue_completion')}
                  onSaved={() =>
                    cache.invalidateQueries({
                      queryKey: [
                        'professional-roster',
                        user?.userId,
                        user?.organisationId,
                        selected,
                      ],
                    })
                  }
                />
              ))
            )}
            <Button variant="outline" onClick={() => void roster.refetch()}>
              Refresh attendance
            </Button>
          </section>
        )}
      </main>
    </Layout>
  );
}
function LearnerReview({
  learner,
  sessionId,
  canAssess,
  canIssue,
  onSaved,
}: {
  learner: Learner;
  sessionId: string;
  canAssess: boolean;
  canIssue: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const [decision, setDecision] = useState('approved'),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const act = async (kind: 'assess' | 'issue') => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (kind === 'assess') {
        await api.post(`${base}/sessions/${sessionId}/assessments`, {
          learnerId: learner.id,
          revision: learner.assessmentRevision,
          decision,
          reason,
        });
        await onSaved();
      } else {
        const result = await api.post<{ created: boolean; row: { certificate_number: string } }>(
          `${base}/sessions/${sessionId}/certificates`,
          { learnerId: learner.id, assessmentRevision: learner.assessmentRevision }
        );
        setNotice(
          `${result.created ? 'Completion certificate issued' : 'Existing course certificate retained'}: ${result.row.certificate_number}. The learner can access their certificate through the existing certificate page.`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action refused');
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="space-y-3 rounded border p-4">
      <h3 className="font-semibold">{learner.name}</h3>
      <p>
        {learner.completedAt ? 'Course completion recorded' : 'Course not completed'} · assessment:{' '}
        {learner.decision ?? 'Not reviewed'}
      </p>
      <p className="text-sm">
        Server quiz result: {learner.quizPercent ?? 0}%. Missing sections:{' '}
        {learner.missing?.sections.length ?? 7}; unanswered quizzes:{' '}
        {learner.missing?.quizzes.length ?? 4}.
      </p>
      {canAssess && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act('assess');
          }}
          className="space-y-3"
        >
          <Label htmlFor={`learner-${learner.id}-decision`}>Completion decision</Label>
          <select
            id={`learner-${learner.id}-decision`}
            className="block rounded border bg-background p-2"
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
          >
            <option value="approved">Approve verified completion</option>
            <option value="rejected">Reject / request further work</option>
          </select>
          <Label htmlFor={`learner-${learner.id}-reason`}>Assessment reason</Label>
          <Textarea
            id={`learner-${learner.id}-reason`}
            required
            minLength={10}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button disabled={busy}>Record completion assessment</Button>
        </form>
      )}
      {canIssue && (
        <Button
          variant="outline"
          disabled={busy || learner.decision !== 'approved'}
          onClick={() => void act('issue')}
        >
          Issue learner completion certificate
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </article>
  );
}
