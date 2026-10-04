import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { CATEGORY_LABELS, REFERRAL_LABELS, RELATIONSHIP_LABELS, STATUS_LABELS } from '@/lib/speakUp';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { ReportingRoutesRegister } from './CounterFraudRecords';
import { useConfirm } from '@/hooks/useConfirm';

const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'];

// GovS 013 component 7 (reporting routes): the public speak-up link, other routes, and the case log.

const logger = createLogger('SpeakUpCases');

interface Intake { enabled: boolean; token: string | null; intro: string | null }
interface CaseSummary {
  id: string; reference: string; category: string; relationship: string; anonymous: boolean; status: string;
  receivedAt: string; assignedUserName?: string; overdueForTriage: boolean;
}
interface CaseDetail extends CaseSummary {
  description: string; occurredWhen?: string; location?: string; peopleInvolved?: string; amountGbp?: number;
  reporterName?: string; reporterEmail?: string; reporterPhone?: string; assignedUserId?: string;
  referral?: string; referralNotes?: string; outcome?: string; incidentId?: string; acknowledgedAt?: string; closedAt?: string;
  messages: { id: string; author: 'reporter' | 'handler'; authorName?: string; body: string; createdAt: string }[];
}
interface Employee { userId: string; userName: string }

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const NONE = '__none';

function IntakeCard() {
  const confirm = useConfirm();
  const [intake, setIntake] = useState<Intake | null>(null);
  const [intro, setIntro] = useState('');

  useEffect(() => {
    api.get<Intake>('/api/v1/compliance/speak-up/intake')
      .then((i) => { setIntake(i); setIntro(i.intro ?? ''); })
      .catch((err: unknown) => logger.error('Failed to load intake', err));
  }, []);

  const save = async (change: { enabled: boolean; intro?: string; regenerateLink?: boolean }) => {
    try {
      const next = await api.put<Intake>('/api/v1/compliance/speak-up/intake', change);
      setIntake(next);
      toast.success(change.regenerateLink ? 'New link created; the old one no longer works' : 'Saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    }
  };

  if (!intake) return null;
  const link = intake.token ? `${window.location.origin}/speak-up/${intake.token}` : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Speak-up link</CardTitle>
        <CardDescription>
          A reporting page anyone with the link can use, anonymously if they choose. Reporters get a case reference and key to follow
          their report and answer your questions. Their internet address is never recorded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch id="speak-up-enabled" checked={intake.enabled} onCheckedChange={(enabled) => save({ enabled })} />
          <Label htmlFor="speak-up-enabled">{intake.enabled ? 'Accepting reports' : 'Switched off'}</Label>
        </div>
        {link && intake.enabled && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
            <code className="text-sm break-all flex-1">{link}</code>
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('Link copied'))}>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" /> Copy
            </Button>
            <Button variant="ghost" size="sm"
              onClick={async () => { if (await confirm({ title: 'Make a new link?', description: 'The current link will stop working straight away.', confirmLabel: 'Make a new link', destructive: true })) save({ enabled: true, regenerateLink: true }); }}>
              New link
            </Button>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="speak-up-intro">Message shown to reporters (optional)</Label>
          <Textarea id="speak-up-intro" rows={2} value={intro} placeholder="e.g. Reports are read by the audit committee chair and the counter fraud lead."
            onChange={(e) => setIntro(e.target.value)} />
          <Button variant="outline" size="sm" onClick={() => save({ enabled: intake.enabled, intro })}>Save message</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CasePanel({ id, employees, onClose, onChange }: { id: string | null; employees: Employee[]; onClose: () => void; onChange: () => void }) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [reply, setReply] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState('medium');
  const [outcome, setOutcome] = useState('');
  const [referralNotes, setReferralNotes] = useState('');

  useEffect(() => {
    setDetail(null);
    if (!id) return;
    api.get<CaseDetail>(`/api/v1/compliance/speak-up/reports/${id}`)
      .then((d) => { setDetail(d); setOutcome(d.outcome ?? ''); setReferralNotes(d.referralNotes ?? ''); })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not open the case'));
  }, [id]);

  const update = async (change: Record<string, unknown>, done = 'Case updated') => {
    if (!detail) return;
    try {
      setDetail(await api.patch<CaseDetail>(`/api/v1/compliance/speak-up/reports/${detail.id}`, change));
      toast.success(done);
      onChange();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const sendReply = async () => {
    if (!detail || !reply.trim()) return;
    try {
      setDetail(await api.post<CaseDetail>(`/api/v1/compliance/speak-up/reports/${detail.id}/messages`, { message: reply.trim() }));
      setReply('');
      toast.success('Message sent; the reporter sees it when they next check');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not send');
    }
  };

  const createIncident = async () => {
    if (!detail) return;
    try {
      setDetail(await api.post<CaseDetail>(`/api/v1/compliance/speak-up/reports/${detail.id}/incident`, { severity: incidentSeverity }));
      toast.success('Incident created in the incident log');
      onChange();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not create the incident');
    }
  };

  const facts: [string, React.ReactNode][] = detail ? [
    ['Category', CATEGORY_LABELS[detail.category] ?? detail.category],
    ['Reporter', detail.anonymous ? 'Anonymous' : [detail.reporterName, detail.reporterEmail, detail.reporterPhone].filter(Boolean).join(' · ')],
    ['Connection', RELATIONSHIP_LABELS[detail.relationship] ?? detail.relationship],
    ['When', detail.occurredWhen ?? '—'],
    ['Where', detail.location ?? '—'],
    ['Amount', detail.amountGbp !== undefined ? `£${detail.amountGbp.toLocaleString('en-GB')}` : '—'],
    ['People involved', detail.peopleInvolved ?? '—'],
    ['Received', `${fmt(detail.receivedAt)}${detail.acknowledgedAt ? ` · reviewed ${fmt(detail.acknowledgedAt)}` : ''}${detail.closedAt ? ` · closed ${fmt(detail.closedAt)}` : ''}`],
  ] : [];

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {!detail ? <p className="text-muted-foreground">Loading…</p> : (
          <div className="space-y-6">
            <SheetHeader>
              <SheetTitle>{detail.reference}</SheetTitle>
              <SheetDescription>Every view of this case is recorded in the audit trail.</SheetDescription>
            </SheetHeader>

            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              {facts.map(([k, v]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></Fragment>)}
            </dl>
            <div>
              <h3 className="text-sm font-medium mb-1">What was reported</h3>
              <p className="whitespace-pre-wrap text-sm rounded-md border p-3">{detail.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="case-status">Status</Label>
                <Select value={detail.status} onValueChange={(status) => update({ status })}>
                  <SelectTrigger id="case-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="case-assignee">Handled by</Label>
                <Select value={detail.assignedUserId ?? NONE} onValueChange={(v) => update({ assignedUserId: v === NONE ? null : v }, 'Case assigned')}>
                  <SelectTrigger id="case-assignee"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nobody yet</SelectItem>
                    {employees.map((e) => <SelectItem key={e.userId} value={e.userId}>{e.userName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="case-referral">Referred to</Label>
                <Select value={detail.referral ?? NONE} onValueChange={(v) => update({ referral: v === NONE ? null : v })}>
                  <SelectTrigger id="case-referral"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not referred</SelectItem>
                    {Object.entries(REFERRAL_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                {detail.incidentId
                  ? <Badge variant="outline">Linked to an incident</Badge>
                  : (
                    <div className="flex items-end gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="case-incident-severity">Incident severity</Label>
                        <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                          <SelectTrigger id="case-incident-severity" className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {INCIDENT_SEVERITIES.map((sv) => <SelectItem key={sv} value={sv}>{sv[0].toUpperCase() + sv.slice(1)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="outline" size="sm" onClick={createIncident}>Create incident</Button>
                    </div>
                  )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-referral-notes">Referral notes</Label>
              <Textarea id="case-referral-notes" rows={2} value={referralNotes} onChange={(e) => setReferralNotes(e.target.value)} />
              <Label htmlFor="case-outcome">Outcome</Label>
              <Textarea id="case-outcome" rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
              <Button variant="outline" size="sm" onClick={() => update({ referralNotes, outcome }, 'Notes saved')}>Save notes</Button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Messages with the reporter</h3>
              {detail.messages.length === 0
                ? <p className="text-sm text-muted-foreground">No messages yet.</p>
                : (
                  <ol className="space-y-2">
                    {detail.messages.map((m) => (
                      <li key={m.id} className={`rounded-md border p-3 ${m.author === 'handler' ? 'bg-muted/50 ml-8' : 'mr-8'}`}>
                        <p className="text-xs text-muted-foreground">{m.author === 'reporter' ? 'Reporter' : m.authorName ?? 'Handler'} · {fmtTime(m.createdAt)}</p>
                        <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                      </li>
                    ))}
                  </ol>
                )}
              {detail.status !== 'closed' && (
                <div className="space-y-2">
                  <Label htmlFor="case-reply">Reply to the reporter</Label>
                  <Textarea id="case-reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <Button size="sm" onClick={sendReply} disabled={!reply.trim()}>Send</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CaseLog({ employees, onChange }: { employees: Employee[]; onChange: () => void }) {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => api.get<CaseSummary[]>('/api/v1/compliance/speak-up/reports').then(setCases)
    .catch((err: unknown) => { logger.error('Failed to load cases', err); setCases([]); }), []);
  useEffect(() => { load(); }, [load]);

  const download = () => api.download('/api/v1/compliance/speak-up/reports?format=csv', 'speak-up-case-log.csv')
    .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Download failed'));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Case log{cases ? ` (${cases.length})` : ''}</CardTitle>
          <CardDescription>Review every new report within 7 days. The CSV leaves out report text and reporter identity.</CardDescription>
        </div>
        <Button variant="outline" size="sm" className="print:hidden" onClick={download}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        {cases === null ? null : cases.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No reports received.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Handled by</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.reference}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmt(c.receivedAt)}</TableCell>
                  <TableCell>{CATEGORY_LABELS[c.category] ?? c.category}</TableCell>
                  <TableCell>{c.anonymous ? 'Anonymous' : 'Named'}</TableCell>
                  <TableCell>
                    {STATUS_LABELS[c.status] ?? c.status}
                    {c.overdueForTriage && <Badge variant="outline" className="ml-2 text-destructive border-destructive/30">Review overdue</Badge>}
                  </TableCell>
                  <TableCell>{c.assignedUserName ?? '—'}</TableCell>
                  <TableCell className="text-right print:hidden">
                    <Button variant="ghost" size="sm" onClick={() => setOpen(c.id)} aria-label={`Open case ${c.reference}`}>Open</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CasePanel id={open} employees={employees} onClose={() => setOpen(null)} onChange={() => { load(); onChange(); }} />
    </Card>
  );
}

/** Reporting routes and speak-up cases. `onChange` refreshes the compliance score. */
export function SpeakUpCases({ employees, onChange }: { employees: Employee[]; onChange: () => void }) {
  return (
    <div className="space-y-6">
      <CaseLog employees={employees} onChange={onChange} />
      <IntakeCard />
      <ReportingRoutesRegister onChange={onChange} />
    </div>
  );
}
