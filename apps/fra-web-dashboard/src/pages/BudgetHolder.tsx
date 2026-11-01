import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BUDGET_HOLDER_GROUPS, BUDGET_HOLDER_PASS_MARK, CONFLICT_OF_INTEREST_PROMPT, DEFAULT_APPROVAL_LIMITS, REPORT_CONTACTS,
  budgetHolderChecklists, budgetHolderParts, budgetHolderPledgeItems, budgetHolderScenarios,
  type ApprovalLimits, type BudgetHolderBlock, type BudgetHolderPart, type ReportContactKey,
} from '@stopfra/shared/data';
import { api } from '@/lib/api';
import { BUDGET_HOLDER_REQUIRED_PARTS, type BudgetHolderProgress } from '@/lib/budget-holder';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle2, Circle, Loader2, ShieldCheck } from 'lucide-react';

interface MeResponse extends BudgetHolderProgress {
  settings: { approvalLimits: ApprovalLimits | null; contacts: Partial<Record<ReportContactKey, { name: string; contact: string }>> };
  speakUpToken: string | null;
}

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

/** Parts to finish before signing, as the server checks them. */
const PARTS_BEFORE_COMMITMENT = budgetHolderParts.map((p) => p.id).filter((id) => id !== 'commitment' && id !== 'resources');

function Blocks({ blocks }: { blocks: BudgetHolderBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((b, i) => (
        <section key={i} className="space-y-2">
          {b.heading && <h3 className="font-semibold">{b.heading}</h3>}
          {b.text && <p className="text-sm leading-relaxed">{b.text}</p>}
          {b.bullets && (
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {b.bullets.map((x) => <li key={x}>{x}</li>)}
            </ul>
          )}
          {b.keyPoint && (
            <p className="rounded-md border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm font-medium">{b.keyPoint}</p>
          )}
        </section>
      ))}
    </div>
  );
}

function Scenarios({ me, onSaved }: { me: MeResponse; onSaved: (p: BudgetHolderProgress) => void }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const answered = Object.keys(answers).length;
  const total = budgetHolderScenarios.length;

  const submit = async () => {
    setSaving(true);
    try {
      const data = await api.post<BudgetHolderProgress & { attempt: { score: number; passed: boolean } }>('/api/v1/budget-holder/me/scenarios', { answers });
      setResult(data.attempt);
      onSaved(data);
      if (data.attempt.passed) toast.success(`Scenarios passed with ${data.attempt.score}%`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save your answers');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {me.scenarioPassed && !result && (
        <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> You passed the scenarios with {me.scenarioScore}%. You can go through them again at any time.</p>
      )}
      {budgetHolderScenarios.map((s, n) => {
        const choice = answers[s.id];
        return (
          <Card key={s.id}>
            <CardHeader>
              <CardDescription>Case {n + 1} of {total} · {s.area}</CardDescription>
              <CardTitle className="text-lg">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="leading-relaxed">{s.howItWorks}</p>
              <div className="grid gap-4 md:grid-cols-3">
                {[['Warning signs', s.redFlags], ['What to do', s.whatToDo], ['Controls that stop it', s.controls]].map(([title, items]) => (
                  <div key={title as string}>
                    <p className="font-medium mb-1">{title as string}</p>
                    <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">{(items as string[]).map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                ))}
              </div>
              <p className="rounded-md bg-muted px-3 py-2"><span className="font-medium">Example: </span>{s.example}</p>
              <fieldset className="space-y-2">
                <legend className="font-medium mb-2">{s.question}</legend>
                <RadioGroup
                  value={choice === undefined ? '' : String(choice)}
                  onValueChange={(v) => { setAnswers((a) => ({ ...a, [s.id]: Number(v) })); setResult(null); }}
                >
                  {s.options.map((o, i) => (
                    <div key={o} className="flex items-start gap-2">
                      <RadioGroupItem value={String(i)} id={`${s.id}-${i}`} className="mt-0.5" />
                      <Label htmlFor={`${s.id}-${i}`} className="font-normal leading-snug">{o}</Label>
                    </div>
                  ))}
                </RadioGroup>
                {choice !== undefined && (
                  <p role="status" className={`text-sm ${choice === s.correct ? 'text-success' : 'text-destructive'}`}>{s.feedback[choice]}</p>
                )}
              </fieldset>
            </CardContent>
          </Card>
        );
      })}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm">
            <p>{answered} of {total} answered. You need {BUDGET_HOLDER_PASS_MARK}% to pass.</p>
            {result && (
              <p className={result.passed ? 'text-success font-medium' : 'text-destructive font-medium'} role="alert">
                {result.passed ? `Passed with ${result.score}%.` : `${result.score}%: not enough this time. Read the feedback, change your answers and try again.`}
              </p>
            )}
          </div>
          <Button onClick={submit} disabled={answered < total || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />} Submit my answers
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Checklists() {
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setTicked((t) => { const n = new Set(t); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {budgetHolderChecklists.map((c) => (
        <Card key={c.id}>
          <CardHeader className="pb-3"><CardTitle className="text-base">{c.title}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {c.items.map((item, i) => {
              const key = `${c.id}-${i}`;
              return (
                <div key={key} className="flex items-start gap-2">
                  <Checkbox id={key} checked={ticked.has(key)} onCheckedChange={() => toggle(key)} className="mt-0.5" />
                  <Label htmlFor={key} className="font-normal text-sm leading-snug">{item}</Label>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Authority({ limits }: { limits: ApprovalLimits | null }) {
  const shown = limits ?? DEFAULT_APPROVAL_LIMITS;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Who can approve what</h3>
        {limits
          ? <Badge>Your organisation's limits</Badge>
          : <Badge variant="outline">Example: your employer has not set its own limits yet</Badge>}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              {shown.bands.map((b) => <TableHead key={b}>{b}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.rows.map((r) => (
              <TableRow key={r.type}>
                <TableCell className="font-medium">{r.type}</TableCell>
                {r.approvers.map((a, i) => <TableCell key={i}>{a || '—'}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Contacts({ me }: { me: MeResponse }) {
  const speakUpUrl = me.speakUpToken ? `/speak-up/${me.speakUpToken}` : null;
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Who to tell in your organisation</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {REPORT_CONTACTS.map((c) => {
          const set = me.settings.contacts[c.key];
          return (
            <div key={c.key} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{c.role}</p>
              {set && (set.name || set.contact)
                ? <p>{set.name}{set.name && set.contact ? ', ' : ''}{set.contact}</p>
                : <p className="text-muted-foreground">Not set by your employer yet</p>}
              <p className="text-xs text-muted-foreground mt-1">Best for: {c.bestFor}</p>
            </div>
          );
        })}
      </div>
      {speakUpUrl ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild><a href={speakUpUrl}>Report a concern in confidence</a></Button>
          <Button variant="ghost" asChild><a href="/speak-up/status">Follow up on a report</a></Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Your employer has not opened its confidential speak-up channel yet. Use the contacts above.</p>
      )}
    </div>
  );
}

function Commitment({ me, userName, onSaved }: { me: MeResponse; userName: string; onSaved: (p: BudgetHolderProgress) => void }) {
  const [agreed, setAgreed] = useState<Set<number>>(new Set());
  const [conflict, setConflict] = useState<'' | 'none' | 'declared'>('');
  const [details, setDetails] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const missing = PARTS_BEFORE_COMMITMENT.filter((p) => !me.completedParts.includes(p));

  if (me.pledgedAt && me.status === 'completed') {
    return (
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2 font-medium text-success"><ShieldCheck className="h-5 w-5" aria-hidden="true" /> Signed by {me.pledgeName} on {formatDate(me.pledgedAt)}.</p>
        <p>Conflict of interest: {me.conflictDeclared ? `declared (${me.conflictDetails})` : 'none declared'}.</p>
        <p className="text-muted-foreground">If a conflict of interest arises during the year, tell your fraud risk owner straight away.</p>
      </div>
    );
  }

  const ready = missing.length === 0;
  const canSign = ready && agreed.size === budgetHolderPledgeItems.length && conflict !== ''
    && (conflict === 'none' || details.trim().length >= 5) && name.trim().length >= 2;

  const sign = async () => {
    setSaving(true);
    try {
      const data = await api.post<BudgetHolderProgress>('/api/v1/budget-holder/me/commitment', {
        name: name.trim(), conflictDeclared: conflict === 'declared', conflictDetails: conflict === 'declared' ? details.trim() : undefined,
      });
      onSaved(data);
      toast.success('Commitment signed. Your employer has your record.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not sign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {!ready && (
        <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm" role="status">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" aria-hidden="true" />
          Finish these parts first: {missing.map((id) => budgetHolderParts.find((p) => p.id === id)?.title).join(', ')}.
        </p>
      )}
      <fieldset disabled={!ready} className="space-y-6 disabled:opacity-60">
        <section className="space-y-2">
          <h3 className="font-semibold">1. Conflict of interest</h3>
          <p className="text-sm">{CONFLICT_OF_INTEREST_PROMPT}</p>
          <RadioGroup value={conflict} onValueChange={(v) => setConflict(v as 'none' | 'declared')}>
            <div className="flex items-center gap-2"><RadioGroupItem value="none" id="coi-none" /><Label htmlFor="coi-none" className="font-normal">No, I have nothing to declare</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="declared" id="coi-yes" /><Label htmlFor="coi-yes" className="font-normal">Yes, I declare an interest</Label></div>
          </RadioGroup>
          {conflict === 'declared' && (
            <div className="space-y-1">
              <Label htmlFor="coi-details">Who or what, and your link with them</Label>
              <Textarea id="coi-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000}
                placeholder="For example: my sister is a director of Acme Cleaning Ltd, one of our suppliers." />
              <p className="text-xs text-muted-foreground">Declaring protects you. Your employer can then make sure someone else approves anything involving them.</p>
            </div>
          )}
        </section>
        <section className="space-y-2">
          <h3 className="font-semibold">2. As a budget holder, I commit to:</h3>
          {budgetHolderPledgeItems.map((item, i) => (
            <div key={item} className="flex items-start gap-2">
              <Checkbox id={`pledge-${i}`} checked={agreed.has(i)} className="mt-0.5"
                onCheckedChange={() => setAgreed((a) => { const n = new Set(a); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
              <Label htmlFor={`pledge-${i}`} className="font-normal text-sm leading-snug">{item}</Label>
            </div>
          ))}
        </section>
        <section className="space-y-1 max-w-sm">
          <h3 className="font-semibold">3. Sign</h3>
          <Label htmlFor="pledge-name">Type your full name</Label>
          <Input id="pledge-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={userName} maxLength={120} autoComplete="name" />
        </section>
        <Button onClick={sign} disabled={!canSign || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />} Sign my commitment
        </Button>
      </fieldset>
    </div>
  );
}

/** Enterprise: the Budget Guide for staff who approve spending, on the web. */
export default function BudgetHolder() {
  const { user } = useAuth();
  const userName = user?.name ?? '';
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    api.get<MeResponse>('/api/v1/budget-holder/me')
      .then(setMe)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load the programme'));
  }, []);

  const firstOpen = useMemo(() => budgetHolderParts.find((p) => !me?.completedParts.includes(p.id))?.id ?? 'legal', [me]);
  const current: BudgetHolderPart = budgetHolderParts.find((p) => p.id === (params.get('part') ?? firstOpen)) ?? budgetHolderParts[0];
  const index = budgetHolderParts.indexOf(current);
  const next = budgetHolderParts[index + 1];
  const go = (id: string) => { setParams({ part: id }); window.scrollTo({ top: 0 }); };
  const saved = (p: BudgetHolderProgress) => setMe((m) => (m ? { ...m, ...p } : m));

  const markRead = async () => {
    if (!me) return;
    setMarking(true);
    try {
      if (!me.completedParts.includes(current.id)) saved(await api.post<BudgetHolderProgress>('/api/v1/budget-holder/me/parts', { partId: current.id }));
      if (next) go(next.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save your progress');
    } finally {
      setMarking(false);
    }
  };

  const renew = async () => {
    try {
      saved(await api.post<BudgetHolderProgress>('/api/v1/budget-holder/me/renew'));
      go('legal');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not start the renewal');
    }
  };

  if (error) {
    return <Layout><div className="container py-12"><p className="text-destructive" role="alert">{error}</p></div></Layout>;
  }
  if (!me) {
    return <Layout><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" /></div></Layout>;
  }

  const done = me.requiredPartsDone;
  const total = BUDGET_HOLDER_REQUIRED_PARTS;
  const answeredBySigning = current.id === 'scenarios' || current.id === 'commitment';

  return (
    <Layout>
      <div className="container py-8 lg:py-12">
        <div className="mb-6 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Budget holder programme</h1>
            {me.required && <Badge variant={me.status === 'completed' ? 'default' : 'destructive'}>Required by your employer</Badge>}
          </div>
          <p className="text-muted-foreground max-w-3xl">
            For everyone who approves spending: your legal duties, how fraud gets past approvers, what to check, how to report, and your signed commitment. About 45 minutes, renewed every year.
          </p>
          <div className="flex items-center gap-3 text-sm">
            <Progress value={(done / total) * 100} className="h-2 w-48" aria-label={`${done} of ${total} parts done`} />
            <span>{done} of {total} parts done</span>
          </div>
        </div>

        {me.status === 'completed' && (
          <Card className="mb-6 border-success/40 bg-success/5">
            <CardContent className="pt-6 text-sm flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" />
              Completed on {formatDate(me.completedAt)}. Renew by {formatDate(me.renewalDueAt)}.
            </CardContent>
          </Card>
        )}
        {me.status === 'renewal_due' && (
          <Card className="mb-6 border-warning/40 bg-warning/5">
            <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-4 text-sm">
              <p>Your yearly renewal is due. You completed the programme on {formatDate(me.completedAt)}.</p>
              <Button size="sm" onClick={renew}>Start this year's renewal</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <nav aria-label="Programme parts" className="space-y-4">
            {BUDGET_HOLDER_GROUPS.map((g) => (
              <div key={g.id}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{g.label}</p>
                <ul className="space-y-0.5">
                  {budgetHolderParts.filter((p) => p.group === g.id).map((p) => {
                    const isDone = me.completedParts.includes(p.id);
                    return (
                      <li key={p.id}>
                        <button type="button" onClick={() => go(p.id)} aria-current={p.id === current.id ? 'page' : undefined}
                          className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${p.id === current.id ? 'bg-muted font-medium' : ''}`}>
                          {isDone
                            ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-label="Done" />
                            : <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-label="Not done" />}
                          {p.title}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <Card>
            <CardHeader>
              <CardDescription>{current.id === 'resources' ? 'For reference' : `Part ${index + 1} of ${total}`} · {current.minutes} min</CardDescription>
              <CardTitle level={2} className="text-2xl">{current.title}</CardTitle>
              <CardDescription>{current.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Blocks blocks={current.blocks} />
              {current.id === 'scenarios' && <Scenarios me={me} onSaved={saved} />}
              {current.id === 'checklists' && <Checklists />}
              {current.id === 'authority' && <Authority limits={me.settings.approvalLimits} />}
              {(current.id === 'reporting' || current.id === 'resources') && <Contacts me={me} />}
              {current.id === 'commitment' && <Commitment me={me} userName={userName} onSaved={saved} />}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                {index > 0
                  ? <Button variant="ghost" onClick={() => go(budgetHolderParts[index - 1].id)}>Previous</Button>
                  : <Button variant="ghost" asChild><Link to="/dashboard">Back to dashboard</Link></Button>}
                {answeredBySigning
                  ? next && <Button variant="outline" onClick={() => go(next.id)}>Next part</Button>
                  : (
                    <Button onClick={markRead} disabled={marking || me.status === 'renewal_due'}>
                      {me.completedParts.includes(current.id) ? (next ? 'Next part' : 'Done') : next ? 'I have read this, next part' : 'I have read this'}
                    </Button>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
