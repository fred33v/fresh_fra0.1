import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ExternalLink, Scale, ShieldCheck, Target, XCircle, PenLine, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  authorityBands, authorityMatrix, checklists, externalContacts, fraudTriangle, goldenRules, internalContacts,
  legalBlocks, pledgeItems, redFlags, reportingSteps, roleOptions, scenarioCategories, trainingResources,
  whistleblowerProtections, type BudgetRole, type ContactKey,
} from '@/data/budgetHolderGuide/content';
import { scenarioData, type Scenario } from '@/data/budgetHolderGuide/scenarios';
import { myths } from '@/data/budgetHolderGuide/myths';
import { readLocal, writeLocal } from '@/lib/localPrefs';

const CONTACTS_KEY = 'guide.contacts';
const ROLES_KEY = 'guide.roles';

// ── Legal duties ───────────────────────────────────────────────

export function LegalSection() {
  return (
    <div className="space-y-4">
      {legalBlocks.map((b) => (
        <Card key={b.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Scale className="h-5 w-5 text-primary" aria-hidden="true" />{b.title}</CardTitle>
            <CardDescription>{b.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            {b.intro && <p className="mb-2">{b.intro}</p>}
            <ul className="list-disc pl-6 space-y-1">{b.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Fraud triangle ─────────────────────────────────────────────

export function FraudBasicsSection() {
  return (
    <div className="space-y-4">
      <p>Fraud happens when three things come together:</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {fraudTriangle.map((t) => (
          <Card key={t.key} className={t.yoursToControl ? 'border-primary ring-1 ring-primary' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base uppercase tracking-wide">{t.title}</CardTitle>
              {t.yoursToControl && <Badge className="w-fit">Your control point</Badge>}
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{t.text}</CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-primary/5">
        <CardContent className="flex gap-3 p-4">
          <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            You cannot control people&apos;s financial pressures or how they justify dishonesty.
            But you <strong>can</strong> remove the opportunity, through strong controls applied every time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Scenarios ──────────────────────────────────────────────────

function ScenarioDecision({ scenario }: { scenario: Scenario }) {
  const [chosen, setChosen] = useState<number | null>(null);
  if (!scenario.decision) return null;
  const choice = chosen === null ? null : scenario.decision.options[chosen];
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <p className="font-medium">{scenario.decision.prompt}</p>
      <div className="grid gap-2" role="group" aria-label="Your decision">
        {scenario.decision.options.map((o, i) => (
          <Button
            key={o.text}
            variant={chosen === i ? (o.correct ? 'default' : 'destructive') : 'outline'}
            className="h-auto whitespace-normal justify-start text-left"
            onClick={() => setChosen(i)}
            aria-pressed={chosen === i}
          >
            {o.text}
          </Button>
        ))}
      </div>
      {choice && (
        <p role="status" className={`flex gap-2 text-sm ${choice.correct ? 'text-success' : 'text-destructive'}`}>
          {choice.correct ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {choice.feedback}
        </p>
      )}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="font-medium mb-1">{title}</h4>
      <ul className="list-disc pl-6 space-y-1 text-sm">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}

export function ScenariosSection() {
  const [roles, setRoles] = useState<BudgetRole[]>(() => readLocal<BudgetRole[]>(ROLES_KEY, []));
  const toggleRole = (id: BudgetRole) => {
    const next = roles.includes(id) ? roles.filter((r) => r !== id) : [...roles, id];
    setRoles(next);
    writeLocal(ROLES_KEY, next);
  };
  const categories = roles.length
    ? scenarioCategories.filter((c) => c.relevantRoles.some((r) => roles.includes(r)))
    : scenarioCategories;

  return (
    <div className="space-y-6">
      <fieldset className="rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">What do you approve? (shows the scenarios most relevant to you)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {roleOptions.map((r) => (
            <div key={r.id} className="flex items-start gap-2">
              <Checkbox id={`role-${r.id}`} checked={roles.includes(r.id)} onCheckedChange={() => toggleRole(r.id)} />
              <Label htmlFor={`role-${r.id}`} className="leading-snug">
                {r.title}
                <span className="block text-xs font-normal text-muted-foreground">{r.description}</span>
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      {categories.map((cat) => {
        const items = scenarioData[cat.id] ?? [];
        return (
          <Card key={cat.id}>
            <CardHeader>
              <CardTitle className="text-lg">{cat.title}</CardTitle>
              <CardDescription>{cat.description} · {items.length} {items.length === 1 ? 'scenario' : 'scenarios'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {items.map((s) => (
                  <AccordionItem key={s.id} value={s.id}>
                    <AccordionTrigger>{s.title}</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p>{s.howItWorks}</p>
                      <List title="Red flags" items={s.redFlags} />
                      <List title="What to do" items={s.whatToDo} />
                      <List title="Controls that stop it" items={s.controls} />
                      <p className="rounded-md bg-muted p-3 text-sm"><strong>Real example: </strong>{s.example}</p>
                      <ScenarioDecision scenario={s} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Red flags ──────────────────────────────────────────────────

export function RedFlagsSection() {
  const groups = [
    { id: 'people', title: 'People & behaviour' },
    { id: 'transactions', title: 'Transactions' },
  ] as const;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => (
        <Card key={g.id}>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />{g.title}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {redFlags.filter((f) => f.category === g.id).map((f) => (
                <li key={f.id} className="flex gap-2 text-sm"><span aria-hidden="true">⚑</span>{f.text}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Checklists ─────────────────────────────────────────────────

export function ChecklistsSection() {
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {checklists.map((list) => {
        const done = list.items.filter((i) => ticked[i.id]).length;
        return (
          <Card key={list.id}>
            <CardHeader>
              <CardTitle className="text-lg">{list.title}</CardTitle>
              <CardDescription>{done} of {list.items.length} checked</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {list.items.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <Checkbox id={`check-${item.id}`} checked={!!ticked[item.id]} onCheckedChange={(v) => setTicked((t) => ({ ...t, [item.id]: v === true }))} />
                  <Label htmlFor={`check-${item.id}`} className="font-normal leading-snug">{item.text}</Label>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Authority ──────────────────────────────────────────────────

export function AuthoritySection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Golden rules</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">{goldenRules.map((r) => <li key={r} className="flex gap-2"><ShieldCheck className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />{r}</li>)}</ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Authority matrix (example)</CardTitle>
          <CardDescription>This is an example. Check your organisation&apos;s own limits.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Type</TableHead>{authorityBands.map((b) => <TableHead key={b}>{b}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {authorityMatrix.map((row) => (
                <TableRow key={row.type}>
                  <TableCell className="font-medium">{row.type}</TableCell>
                  {row.approvers.map((a, i) => <TableCell key={authorityBands[i]}>{a}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Contacts (shared by reporting and resources) ───────────────

function useContacts() {
  const [contacts, setContacts] = useState<Partial<Record<ContactKey, string>>>(() => readLocal(CONTACTS_KEY, {}));
  const update = (key: ContactKey, value: string) => {
    const next = { ...contacts, [key]: value };
    setContacts(next);
    writeLocal(CONTACTS_KEY, next);
  };
  return { contacts, update };
}

function InternalContacts() {
  const { contacts, update } = useContacts();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Internal reporting channels</CardTitle>
        <CardDescription>Add your organisation&apos;s contacts so they are to hand. They are kept on this device only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {internalContacts.map((c) => (
          <div key={c.key} className="grid gap-1">
            <Label htmlFor={`contact-${c.key}`}>{c.role}</Label>
            <Input id={`contact-${c.key}`} placeholder="Name, phone or email" value={contacts[c.key] ?? ''} onChange={(e) => update(c.key, e.target.value)} maxLength={200} />
            <p className="text-xs text-muted-foreground">Best for: {c.bestFor}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExternalLinks({ title, items }: { title: string; items: typeof externalContacts }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((x) => (
            <li key={x.name}>
              <a href={x.href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline inline-flex items-center gap-1">
                {x.name}<ExternalLink className="h-3 w-3" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
              </a>
              <div className="text-sm text-muted-foreground">{x.contact} · {x.detail}</div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ReportingSection() {
  const tone = { danger: 'border-destructive', warning: 'border-warning', success: 'border-success' };
  return (
    <div className="space-y-4">
      <ol className="grid gap-4 md:grid-cols-3">
        {reportingSteps.map((s) => (
          <li key={s.id}>
            <Card className={`h-full border-t-4 ${tone[s.tone]}`}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{s.id}. {s.title}</CardTitle></CardHeader>
              <CardContent className="text-sm">{s.text}</CardContent>
            </Card>
          </li>
        ))}
      </ol>
      <InternalContacts />
      <ExternalLinks title="External reporting (if internal channels fail)" items={externalContacts.slice(0, 2)} />
    </div>
  );
}

// ── Whistleblowing ─────────────────────────────────────────────

export function WhistleblowingSection() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {whistleblowerProtections.map((p) => (
          <Card key={p.title}>
            <CardHeader><CardTitle className="text-base">{p.title}</CardTitle></CardHeader>
            <CardContent><ul className="list-disc pl-5 space-y-1 text-sm">{p.items.map((i) => <li key={i}>{i}</li>)}</ul></CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-warning">
        <CardContent className="p-4">
          <h3 className="font-medium mb-1">If you face retaliation</h3>
          <p className="text-sm">
            Contact HR or Legal straight away. Retaliating against a whistleblower is illegal and can lead to an employment tribunal claim.
            You can also raise a concern through your organisation&apos;s speak-up channel, which can be anonymous.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Myths ──────────────────────────────────────────────────────

export function MythsSection() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {myths.map((m) => {
        const shown = !!revealed[m.id];
        return (
          <Card key={m.id}>
            <CardContent className="p-4 space-y-3">
              <Badge variant="destructive">Myth</Badge>
              <p className="font-medium">{m.myth}</p>
              {shown ? (
                <>
                  <Badge className="bg-success text-success-foreground">Reality</Badge>
                  <p className="text-sm">{m.reality}</p>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setRevealed((r) => ({ ...r, [m.id]: true }))}>Show the reality</Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Pledge ─────────────────────────────────────────────────────

type PledgeRecord = { signature: string; created_at?: string; updated_at?: string };

export function PledgeSection() {
  const { user } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<PledgeRecord | null>(null);
  const [loading, setLoading] = useState(!!user);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    api.get<PledgeRecord | null>('/api/v1/budget-guide/pledge')
      .then((p) => { if (!cancelled) setSaved(p); })
      .catch(() => { /* not recorded yet, or not available */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  const sign = async () => {
    setSaving(true);
    try {
      const signature = `${name.trim()} — ${new Date().toLocaleDateString('en-GB')}`;
      const record = await api.post<PledgeRecord>('/api/v1/budget-guide/pledge', { signature });
      setSaved(record ?? { signature });
      toast.success('Your pledge has been recorded');
    } catch (err: unknown) {
      const unavailable = err instanceof ApiError && err.code === 'NO_DB';
      toast.error(unavailable ? 'Pledges cannot be recorded on this server yet.' : 'Your pledge could not be recorded. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">As a budget-holder, I commit to:</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal pl-6 space-y-1">{pledgeItems.map((p) => <li key={p}>{p}</li>)}</ol>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Checking your pledge…</p>
        ) : saved ? (
          <p role="status" className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />Pledge recorded: {saved.signature}
          </p>
        ) : !user ? (
          <p className="text-sm">
            <Link to="/auth?returnTo=%2Fguide%2Fpledge" className="text-primary underline">Sign in</Link> to record your pledge.
          </p>
        ) : (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-start gap-2">
              <Checkbox id="pledge-agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
              <Label htmlFor="pledge-agree" className="font-normal leading-snug">I understand these responsibilities and commit to them.</Label>
            </div>
            <div className="grid gap-1 max-w-sm">
              <Label htmlFor="pledge-name">Type your full name as your signature</Label>
              <Input id="pledge-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
            </div>
            <Button onClick={sign} disabled={!agreed || name.trim().length < 2 || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <PenLine className="mr-2 h-4 w-4" aria-hidden="true" />}
              Sign my pledge
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Resources ──────────────────────────────────────────────────

export function ResourcesSection() {
  return (
    <div className="space-y-4">
      <InternalContacts />
      <div className="grid gap-4 md:grid-cols-2">
        <ExternalLinks title="External reporting" items={externalContacts} />
        <ExternalLinks title="Training & resources" items={trainingResources} />
      </div>
    </div>
  );
}
