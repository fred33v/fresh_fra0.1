import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { anonymousApi, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, ShieldCheck } from 'lucide-react';
import { CATEGORY_LABELS, RELATIONSHIP_LABELS } from '@/lib/speakUp';

// Public speak-up pages (GovS 013 reporting routes). No sign-in: requests go through
// anonymousApi, which never sends a token, cookies or the page address.

interface IntakePage { organisationName: string; intro: string | null; categories: string[]; relationships: string[] }
interface Receipt { reference: string; accessKey: string; message: string }
interface CaseStatus { reference: string; status: string; receivedAt: string; updatedAt: string; messages: { author: 'reporter' | 'handler'; body: string; createdAt: string }[] }

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <main className="container max-w-2xl py-10 space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-mono text-lg tracking-wider">{value}</p>
      </div>
      <Button variant="outline" size="sm" aria-label={`Copy ${label.toLowerCase()}`}
        onClick={() => navigator.clipboard?.writeText(value).then(() => setCopied(true)).catch(() => setCopied(false))}>
        <Copy className="mr-2 h-4 w-4" aria-hidden="true" />{copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

// ── Make a report ───────────────────────────────────────────────

function ReportForm() {
  const { token = '' } = useParams();
  const [page, setPage] = useState<IntakePage | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [form, setForm] = useState({
    category: 'fraud', relationship: 'employee', description: '', occurredWhen: '', location: '', peopleInvolved: '',
    amountGbp: '', anonymous: 'yes', name: '', email: '', phone: '',
  });
  const [error, setError] = useState<string | null>(null);
  // A validation error belongs to a field: shown beside it, linked to it, and focused
  const [fieldError, setFieldError] = useState<{ field: 'description' | 'contact'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(null); setFieldError(null); };
  const invalid = (field: 'description' | 'contact', message: string, focusId: string) => {
    setFieldError({ field, message });
    // Wait for the error to render so the field is announced with it
    requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  };

  useEffect(() => {
    anonymousApi.get<IntakePage>(`/api/v1/speak-up/${encodeURIComponent(token)}`).then(setPage).catch(() => setUnavailable(true));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const anonymous = form.anonymous === 'yes';
    if (form.description.trim().length < 20) return invalid('description', 'Describe what happened in at least 20 characters.', 'su-description');
    if (!anonymous && !form.email.trim() && !form.phone.trim()) return invalid('contact', 'Give an email or phone number, or choose to stay anonymous.', 'su-email');

    const optional = (v: string) => (v.trim() ? v.trim() : undefined);
    setBusy(true);
    try {
      setReceipt(await anonymousApi.post<Receipt>(`/api/v1/speak-up/${encodeURIComponent(token)}/reports`, {
        category: form.category, relationship: form.relationship, description: form.description.trim(),
        occurredWhen: optional(form.occurredWhen), location: optional(form.location), peopleInvolved: optional(form.peopleInvolved),
        amountGbp: form.amountGbp.trim() ? Number(form.amountGbp) : undefined,
        anonymous,
        ...(anonymous ? {} : { name: optional(form.name), email: optional(form.email), phone: optional(form.phone) }),
      }));
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Your report could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (unavailable) {
    return (
      <Shell title="Report a concern">
        <Card><CardContent className="pt-6">This reporting link is not available. Check the link with the organisation, or report to <a className="underline" href="https://www.reportfraud.police.uk" target="_blank" rel="noopener noreferrer">Report Fraud</a> (formerly Action Fraud).</CardContent></Card>
      </Shell>
    );
  }
  if (!page) return <Shell title="Report a concern"><Skeleton className="h-96 w-full" /></Shell>;

  if (receipt) {
    return (
      <Shell title="Your report has been sent">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Write these down now</CardTitle>
            <CardDescription>{receipt.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CopyLine label="Case reference" value={receipt.reference} />
            <CopyLine label="Access key" value={receipt.accessKey} />
            <p className="text-sm">
              Use them on the <Link className="underline" to="/speak-up/status">follow your report</Link> page to see progress, answer questions and add information.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const anonymous = form.anonymous === 'yes';
  return (
    <Shell title={`Report a concern to ${page.organisationName}`}>
      <Card>
        <CardContent className="pt-6 space-y-2 text-sm">
          {page.intro && <p>{page.intro}</p>}
          <p>You can report suspected fraud, bribery or corruption here, anonymously if you prefer. Your internet address is not recorded.</p>
          <p className="text-muted-foreground">If someone is in immediate danger, call 999.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form className="space-y-4" onSubmit={submit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="su-category">What is it about?</Label>
                <Select value={form.category} onValueChange={(v) => set('category', v)}>
                  <SelectTrigger id="su-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{page.categories.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-relationship">Your connection</Label>
                <Select value={form.relationship} onValueChange={(v) => set('relationship', v)}>
                  <SelectTrigger id="su-relationship"><SelectValue /></SelectTrigger>
                  <SelectContent>{page.relationships.map((r) => <SelectItem key={r} value={r}>{RELATIONSHIP_LABELS[r] ?? r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-description">What happened?</Label>
              <Textarea id="su-description" rows={6} value={form.description} onChange={(e) => set('description', e.target.value)}
                aria-invalid={fieldError?.field === 'description'}
                aria-describedby={fieldError?.field === 'description' ? 'su-description-error su-description-hint' : 'su-description-hint'} />
              {fieldError?.field === 'description' && <p id="su-description-error" className="text-sm text-destructive">{fieldError.message}</p>}
              <p id="su-description-hint" className="text-xs text-muted-foreground">Include what you saw, who was involved and how you know. Avoid details that would identify you if you want to stay anonymous.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="su-when">When (optional)</Label>
                <Input id="su-when" value={form.occurredWhen} placeholder="e.g. since March 2026" onChange={(e) => set('occurredWhen', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-where">Where or which team (optional)</Label>
                <Input id="su-where" value={form.location} onChange={(e) => set('location', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-amount">Amount involved, £ (optional)</Label>
                <Input id="su-amount" type="number" min={0} value={form.amountGbp} onChange={(e) => set('amountGbp', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-people">People involved (optional)</Label>
              <Textarea id="su-people" rows={2} value={form.peopleInvolved} onChange={(e) => set('peopleInvolved', e.target.value)} />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Do you want to give your name?</legend>
              <RadioGroup value={form.anonymous} onValueChange={(v) => set('anonymous', v)}>
                <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="su-anon-yes" /><Label htmlFor="su-anon-yes" className="font-normal">No, stay anonymous</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="no" id="su-anon-no" /><Label htmlFor="su-anon-no" className="font-normal">Yes, they can contact me</Label></div>
              </RadioGroup>
            </fieldset>
            {!anonymous && (
              <div className="space-y-1.5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5"><Label htmlFor="su-name">Name</Label><Input id="su-name" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="su-email">Email</Label><Input id="su-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                    aria-invalid={fieldError?.field === 'contact'} aria-describedby={fieldError?.field === 'contact' ? 'su-contact-error' : undefined} /></div>
                  <div className="space-y-1.5"><Label htmlFor="su-phone">Phone</Label><Input id="su-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)}
                    aria-invalid={fieldError?.field === 'contact'} aria-describedby={fieldError?.field === 'contact' ? 'su-contact-error' : undefined} /></div>
                </div>
                {fieldError?.field === 'contact' && <p id="su-contact-error" className="text-sm text-destructive">{fieldError.message}</p>}
              </div>
            )}

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-sm text-center"><Link className="underline" to="/speak-up/status">Already reported? Follow your report</Link></p>
      <p className="text-xs text-center text-muted-foreground"><Link className="underline" to="/privacy#speak-up">How your report is protected</Link></p>
    </Shell>
  );
}

// ── Follow a report ─────────────────────────────────────────────

function FollowReport() {
  const [reference, setReference] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [found, setFound] = useState<CaseStatus | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (path: string, body: Record<string, string>) => {
    setBusy(true);
    setError(null);
    try {
      setFound(await anonymousApi.post<CaseStatus>(`/api/v1/speak-up/${path}`, body));
      return true;
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const lookUp = (e: React.FormEvent) => { e.preventDefault(); call('status', { reference: reference.trim(), accessKey: accessKey.trim() }); };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (await call('messages', { reference: reference.trim(), accessKey: accessKey.trim(), message: message.trim() })) setMessage('');
  };

  return (
    <Shell title="Follow your report">
      {!found ? (
        <Card>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={lookUp} noValidate>
              <div className="space-y-1.5"><Label htmlFor="fr-ref">Case reference</Label><Input id="fr-ref" value={reference} placeholder="SU-XXXXXXXX" autoComplete="off" onChange={(e) => setReference(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="fr-key">Access key</Label><Input id="fr-key" type="password" value={accessKey} autoComplete="off" onChange={(e) => setAccessKey(e.target.value)} /></div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" disabled={busy || !reference.trim() || !accessKey.trim()}>Show my report</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{found.reference}: {found.status}</CardTitle>
            <CardDescription>Received {fmt(found.receivedAt)} · last updated {fmt(found.updatedAt)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {found.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet. Check back here; the people handling your report may ask you questions.</p>
            ) : (
              <ol className="space-y-3" aria-label="Messages">
                {found.messages.map((m, i) => (
                  <li key={i} className={`rounded-md border p-3 ${m.author === 'reporter' ? 'bg-muted/50 ml-8' : 'mr-8'}`}>
                    <p className="text-xs text-muted-foreground">{m.author === 'reporter' ? 'You' : 'Case handler'} · {fmt(m.createdAt)}</p>
                    <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                  </li>
                ))}
              </ol>
            )}
            {found.status !== 'Closed' ? (
              <form className="space-y-2" onSubmit={send}>
                <Label htmlFor="fr-message">Add information or reply</Label>
                <Textarea id="fr-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                <Button type="submit" disabled={busy || !message.trim()}>Send</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">This case is closed. Thank you for speaking up.</p>
            )}
          </CardContent>
        </Card>
      )}
    </Shell>
  );
}

export default function SpeakUp({ mode }: { mode: 'report' | 'follow' }) {
  return mode === 'follow' ? <FollowReport /> : <ReportForm />;
}
