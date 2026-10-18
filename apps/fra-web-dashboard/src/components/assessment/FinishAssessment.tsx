import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquareHeart, PenLine, Star, Target } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AssessmentRecord } from '@/types/assessment';

/** Stored with the assessment's answers, as the mobile app's priorities step did. */
export const PRIORITIES_KEY = 'priorities.text';

type SignOff = { signerName: string; signerRole: string | null; signedAt: string; statement: string };

const RATING_LABELS = ['Not useful', 'Slightly useful', 'Useful', 'Very useful', 'Extremely useful'];

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

/**
 * The mobile app's last steps after an assessment: your priorities, the employer's
 * sign-off, and feedback on the health check. All three are now saved on the server.
 */
export function FinishAssessment({ assessmentId }: { assessmentId: string }) {
  const { user, profile } = useAuth();
  const isManager = user?.role === 'employer' || user?.role === 'admin';

  const [record, setRecord] = useState<AssessmentRecord | null>(null);
  const [priorities, setPriorities] = useState('');
  const [savingPriorities, setSavingPriorities] = useState(false);

  const [signOff, setSignOff] = useState<SignOff | null>(null);
  const [statement, setStatement] = useState('');
  const [signerName, setSignerName] = useState(profile?.full_name ?? user?.name ?? '');
  const [signerRole, setSignerRole] = useState(profile?.job_title ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [signing, setSigning] = useState(false);

  const [rating, setRating] = useState<number | null>(null);
  const [comments, setComments] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<AssessmentRecord>(`/api/v1/assessments/${assessmentId}`).catch(() => null),
      api.get<{ signOff: SignOff | null; statement: string }>(`/api/v1/assessments/${assessmentId}/sign-off`).catch(() => null),
    ]).then(([rec, so]) => {
      if (cancelled) return;
      setRecord(rec);
      setPriorities(typeof rec?.answers?.[PRIORITIES_KEY] === 'string' ? (rec.answers[PRIORITIES_KEY] as string) : '');
      setSignOff(so?.signOff ?? null);
      setStatement(so?.statement ?? '');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [assessmentId]);

  if (loading) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading…</p>;
  }

  const canEditPriorities = !!record && (isManager || record.createdByUserId === user?.id);

  const savePriorities = async () => {
    if (!record) return;
    setSavingPriorities(true);
    try {
      // The server replaces the answers as a whole, so send them all with the priorities added
      const answers = { ...record.answers, [PRIORITIES_KEY]: priorities.trim() };
      const updated = await api.patch<AssessmentRecord>(`/api/v1/assessments/${assessmentId}`, { answers });
      setRecord(updated ?? { ...record, answers });
      toast.success('Your priorities have been saved');
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Your priorities could not be saved. Please try again.'));
    } finally {
      setSavingPriorities(false);
    }
  };

  const sign = async () => {
    setSigning(true);
    try {
      const saved = await api.post<SignOff>(`/api/v1/assessments/${assessmentId}/sign-off`, {
        signerName: signerName.trim(), signerRole: signerRole.trim() || undefined, confirm: true,
      });
      setSignOff(saved);
      toast.success('Assessment signed off');
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'The assessment could not be signed off. Please try again.'));
    } finally {
      setSigning(false);
    }
  };

  const sendFeedback = async () => {
    if (!rating) return;
    setSendingFeedback(true);
    try {
      await api.post(`/api/v1/assessments/${assessmentId}/feedback`, { rating, comments: comments.trim() || undefined });
      setFeedbackSent(true);
      toast.success('Thank you for your feedback');
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Your feedback could not be sent. Please try again.'));
    } finally {
      setSendingFeedback(false);
    }
  };

  return (
    <section aria-labelledby="finish-heading" className="space-y-4">
      <h2 id="finish-heading" className="text-xl font-semibold">Finish your assessment</h2>

      {/* 1. Priorities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Target className="h-5 w-5 text-primary" aria-hidden="true" />What matters most to you?</CardTitle>
          <CardDescription>Note your organisation&apos;s fraud prevention priorities, so they sit alongside these results.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="priorities" className="sr-only">Your priorities</Label>
          <Textarea
            id="priorities"
            value={priorities}
            onChange={(e) => setPriorities(e.target.value)}
            placeholder="For example: tighten supplier bank-detail checks; train budget-holders this quarter"
            maxLength={2000}
            readOnly={!canEditPriorities}
            rows={4}
          />
          {canEditPriorities && (
            <Button variant="outline" onClick={savePriorities} disabled={savingPriorities}>
              {savingPriorities && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}Save priorities
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 2. Sign-off */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><PenLine className="h-5 w-5 text-primary" aria-hidden="true" />Sign-off</CardTitle>
          <CardDescription>The person responsible confirms they have reviewed and authorise this assessment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {signOff ? (
            <p role="status" className="flex items-start gap-2 rounded-md bg-success/10 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Signed off by <strong>{signOff.signerName}</strong>{signOff.signerRole ? `, ${signOff.signerRole}` : ''} on{' '}
                {new Date(signOff.signedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
              </span>
            </p>
          ) : !isManager ? (
            <p className="text-sm text-muted-foreground">Not signed off yet. An employer or admin on your account can sign it off.</p>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <Checkbox id="signoff-confirm" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
                <Label htmlFor="signoff-confirm" className="font-normal leading-snug">{statement}</Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="signoff-name">Full name (your signature)</Label>
                  <Input id="signoff-name" value={signerName} onChange={(e) => setSignerName(e.target.value)} maxLength={120} autoComplete="name" />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="signoff-role">Job title (optional)</Label>
                  <Input id="signoff-role" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} maxLength={120} autoComplete="organization-title" />
                </div>
              </div>
              <Button onClick={sign} disabled={!confirmed || signerName.trim().length < 2 || signing}>
                {signing && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}Sign off assessment
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 3. Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><MessageSquareHeart className="h-5 w-5 text-primary" aria-hidden="true" />How useful was this health check?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedbackSent ? (
            <p role="status" className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />Thank you, your feedback has been sent.</p>
          ) : (
            <>
              <div role="radiogroup" aria-label="Rating" className="flex gap-1">
                {RATING_LABELS.map((label, i) => {
                  const value = i + 1;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={rating === value}
                      aria-label={`${value} out of 5, ${label}`}
                      onClick={() => setRating(value)}
                      className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Star className={`h-7 w-7 ${rating && rating >= value ? 'fill-warning text-warning' : 'text-muted-foreground'}`} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              {rating && <p className="text-sm text-muted-foreground">{RATING_LABELS[rating - 1]}</p>}
              <Label htmlFor="feedback-comments">Anything we could improve? (optional)</Label>
              <Textarea id="feedback-comments" value={comments} onChange={(e) => setComments(e.target.value)} maxLength={2000} rows={3} />
              <Button variant="outline" onClick={sendFeedback} disabled={!rating || sendingFeedback}>
                {sendingFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}Send feedback
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
