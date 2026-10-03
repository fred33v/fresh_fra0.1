import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { StatusLabel, type ComplianceStatus } from '@/components/enterprise/ComplianceStatus';

const logger = createLogger('Compliance');

// ── Types (mirror /api/v1/compliance responses) ─────────────────

type Status = ComplianceStatus;
interface Requirement { id: string; name: string; status: Status; evidence: string; recommendation?: string }
interface Framework { score: number; requirements: Requirement[] }
interface Metrics {
  employees: number; employeesAssessed: number; assessmentCoverage: number;
  riskLevels: { high: number; medium: number; low: number; not_scored: number };
  trainingCompleted: number; trainingCoverage: number; latestAssessmentAt: string | null;
  registerRisks: number; openHighRisks: number; highRisksWithoutOwnerOrPlan: number;
  openIncidents: number; openSeriousIncidents: number; seniorManagers: number; seniorManagersReviewedInYear: number;
  keypassesIssued: number; keypassesUsed: number; auditEvents: number;
}
interface AreaRisk { area: string; employeesFlagged: number; highestPriority: 'high' | 'medium' | 'low'; averageResidual: number; titles: string[] }
interface Report { generatedAt: string; eccta2023: Framework; govs013: Framework; metrics: Metrics; topRiskAreas: AreaRisk[]; disclaimer: string }
interface Gap { framework: string; requirementId: string; requirement: string; status: Status; priority: 'CRITICAL' | 'HIGH' | 'MEDIUM'; evidence: string; recommendation: string }
interface Incident { id: string; type: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; reportedAt: string; resolvedAt?: string; resolutionNotes?: string }
interface SeniorManager { id: string; userId: string; userName?: string; role: string; lastReviewed?: string; reviewNotes?: string }
interface TrainingRow { userId: string; name: string; email: string; department: string | null; completedAt: string | null; certificateNumber: string | null; trained: boolean }
interface AuditEvent { id: string; eventType: string; actorEmail?: string; resourceType?: string; resourceId?: string; createdAt: string }
interface Employee { userId: string; userName: string }

const INCIDENT_TYPES: Record<string, string> = {
  fraud_incident: 'Fraud incident', data_breach: 'Data breach', non_compliance: 'Non-compliance', policy_violation: 'Policy violation', other: 'Other',
};
const SENIOR_ROLES = ['CEO', 'CFO', 'COO', 'CTO', 'CISO', 'Board Chair', 'Executive Director', 'Other'];

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

async function downloadCsv(path: string, filename: string) {
  try {
    await api.download(path, filename);
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Download failed');
  }
}

// ── Overview / board report ─────────────────────────────────────

function FrameworkCard({ title, subtitle, framework }: { title: string; subtitle: string; framework: Framework }) {
  return (
    <Card className="break-inside-avoid">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </div>
          <p className="text-3xl font-bold tabular-nums" aria-label={`${title} score ${framework.score}%`}>{framework.score}%</p>
        </div>
        <Progress value={framework.score} className="mt-2" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {framework.requirements.map((r) => (
            <li key={r.id} className="py-3 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{r.name}</span>
                <StatusLabel status={r.status} />
              </div>
              <p className="text-sm text-muted-foreground">{r.evidence}</p>
              {r.recommendation && <p className="text-sm"><span className="font-medium">Next step:</span> {r.recommendation}</p>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Overview({ report }: { report: Report }) {
  const m = report.metrics;
  const tiles = [
    { label: 'Staff assessed', value: `${m.assessmentCoverage}%`, sub: `${m.employeesAssessed} of ${m.employees}` },
    { label: 'Staff trained', value: `${m.trainingCoverage}%`, sub: `${m.trainingCompleted} of ${m.employees}` },
    { label: 'High-risk staff', value: m.riskLevels.high, sub: `${m.riskLevels.medium} medium · ${m.riskLevels.low} low` },
    { label: 'Open high risks', value: m.openHighRisks, sub: `${m.highRisksWithoutOwnerOrPlan} without owner or plan` },
    { label: 'Open incidents', value: m.openIncidents, sub: `${m.openSeriousIncidents} serious` },
    { label: 'Senior managers reviewed', value: `${m.seniorManagersReviewedInYear}/${m.seniorManagers}`, sub: 'in the last 12 months' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} className="break-inside-avoid">
            <CardHeader className="pb-1"><CardDescription>{t.label}</CardDescription></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FrameworkCard title="ECCTA 2023" subtitle="Failure to prevent fraud — the six principles of reasonable procedures" framework={report.eccta2023} />
        <FrameworkCard title="GovS 013" subtitle="Counter-fraud functional standard indicators" framework={report.govs013} />
      </div>

      {report.topRiskAreas.length > 0 && (
        <Card className="break-inside-avoid">
          <CardHeader><CardTitle className="text-lg">Highest-risk areas from staff assessments</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Risks identified</TableHead>
                  <TableHead className="text-right">Staff flagging</TableHead>
                  <TableHead className="text-right">Avg residual</TableHead>
                  <TableHead>Highest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.topRiskAreas.map((a) => (
                  <TableRow key={a.area}>
                    <TableCell className="font-medium">{a.area}</TableCell>
                    <TableCell>{a.titles.join(', ')}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.employeesFlagged}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.averageResidual}</TableCell>
                    <TableCell className="capitalize">{a.highestPriority}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">{report.disclaimer}</p>
    </div>
  );
}

// ── Gap analysis ────────────────────────────────────────────────

function Gaps() {
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  useEffect(() => {
    api.get<{ gaps: Gap[] }>('/api/v1/compliance/gap-analysis')
      .then((d) => setGaps(d.gaps))
      .catch((err: unknown) => { logger.error('Gap analysis failed', err); setGaps([]); });
  }, []);

  if (!gaps) return <Skeleton className="h-48 w-full" />;
  if (gaps.length === 0) {
    return <Card><CardContent className="pt-6 text-center text-muted-foreground">No gaps found — every tracked requirement is met.</CardContent></Card>;
  }
  const PRIORITY_CLASS = { CRITICAL: 'bg-destructive/10 text-destructive border-destructive/30', HIGH: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200', MEDIUM: '' };
  return (
    <div className="space-y-3">
      {gaps.map((g) => (
        <Card key={`${g.framework}-${g.requirementId}`}>
          <CardContent className="pt-6 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={PRIORITY_CLASS[g.priority]}>{g.priority}</Badge>
              <span className="text-sm text-muted-foreground">{g.framework}</span>
              <span className="font-medium">{g.requirement}</span>
            </div>
            <p className="text-sm text-muted-foreground">{g.evidence}</p>
            {g.recommendation && <p className="text-sm"><span className="font-medium">Recommendation:</span> {g.recommendation}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Incidents ───────────────────────────────────────────────────

function Incidents({ onChange }: { onChange: () => void }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [type, setType] = useState('fraud_incident');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get<Incident[]>('/api/v1/compliance/incidents').then(setIncidents)
    .catch((err: unknown) => logger.error('Failed to load incidents', err)), []);
  useEffect(() => { load(); }, [load]);

  const record = async () => {
    if (!description.trim()) {
      setFormError('Describe what happened');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/v1/compliance/incidents', { type, severity, description: description.trim() });
      setDescription('');
      toast.success('Incident recorded');
      await load();
      onChange();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to record incident');
    } finally {
      setBusy(false);
    }
  };

  const setResolved = async (incident: Incident, resolved: boolean) => {
    const resolutionNotes = resolved ? window.prompt('Resolution notes (optional)') ?? undefined : undefined;
    try {
      await api.patch(`/api/v1/compliance/incidents/${incident.id}`, { resolved, resolutionNotes });
      await load();
      onChange();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-lg">Record an incident</CardTitle>
          <CardDescription>Logging incidents and their resolution evidences your fraud response plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(INCIDENT_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{['low', 'medium', 'high', 'critical'].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="incident-description">What happened</Label>
            <Textarea id="incident-description" rows={3} value={description} aria-invalid={!!formError}
              onChange={(e) => { setDescription(e.target.value); setFormError(null); }} />
          </div>
          {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
          <Button onClick={record} disabled={busy}>Record incident</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Incident log ({incidents.length})</CardTitle>
          <Button variant="outline" size="sm" className="print:hidden" onClick={() => downloadCsv('/api/v1/compliance/incidents?format=csv', 'incidents.csv')}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No incidents recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reported</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(i.reportedAt)}</TableCell>
                    <TableCell>{INCIDENT_TYPES[i.type] ?? i.type}</TableCell>
                    <TableCell className="capitalize">{i.severity}</TableCell>
                    <TableCell className="max-w-md">
                      {i.description}
                      {i.resolutionNotes && <span className="block text-xs text-muted-foreground mt-1">Resolution: {i.resolutionNotes}</span>}
                    </TableCell>
                    <TableCell>{i.resolvedAt ? `Resolved ${fmtDate(i.resolvedAt)}` : <Badge variant="outline">Open</Badge>}</TableCell>
                    <TableCell className="text-right print:hidden">
                      <Button variant="ghost" size="sm" onClick={() => setResolved(i, !i.resolvedAt)}>
                        {i.resolvedAt ? 'Reopen' : 'Mark resolved'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Senior management accountability ────────────────────────────

function SeniorManagement({ employees, onChange }: { employees: Employee[]; onChange: () => void }) {
  const [managers, setManagers] = useState<SeniorManager[]>([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('CEO');
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => api.get<SeniorManager[]>('/api/v1/compliance/senior-management').then(setManagers)
    .catch((err: unknown) => logger.error('Failed to load senior managers', err)), []);
  useEffect(() => { load(); }, [load]);

  const today = () => new Date().toISOString().slice(0, 10);

  const add = async () => {
    if (!userId) {
      setFormError('Choose the person accountable');
      return;
    }
    try {
      await api.post('/api/v1/compliance/senior-management', { userId, role, lastReviewed: today() });
      setUserId('');
      toast.success('Senior manager added');
      await load();
      onChange();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to add');
    }
  };

  const markReviewed = async (m: SeniorManager) => {
    try {
      await api.patch(`/api/v1/compliance/senior-management/${m.id}`, { lastReviewed: today() });
      toast.success('Review recorded');
      await load();
      onChange();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const remove = async (m: SeniorManager) => {
    if (!window.confirm(`Remove ${m.userName ?? 'this person'} (${m.role})?`)) return;
    try {
      await api.delete(`/api/v1/compliance/senior-management/${m.id}`);
      await load();
      onChange();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    }
  };

  const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Senior management accountability</CardTitle>
        <CardDescription>
          ECCTA 2023 expects top-level commitment. Record who is accountable for fraud prevention and when they last reviewed it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="space-y-1.5">
            <Label>Person</Label>
            <Select value={userId} onValueChange={(v) => { setUserId(v); setFormError(null); }}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Choose a person" /></SelectTrigger>
              <SelectContent>{employees.map((e) => <SelectItem key={e.userId} value={e.userId}>{e.userName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{SENIOR_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={add}>Add</Button>
        </div>
        {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}

        {managers.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No senior managers recorded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last review</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map((m) => {
                const stale = !m.lastReviewed || new Date(m.lastReviewed).getTime() < yearAgo;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.userName ?? '—'}</TableCell>
                    <TableCell>{m.role}</TableCell>
                    <TableCell>
                      {fmtDate(m.lastReviewed)}
                      {stale && <Badge variant="outline" className="ml-2 text-destructive border-destructive/30">Review due</Badge>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap print:hidden">
                      <Button variant="ghost" size="sm" onClick={() => markReviewed(m)}>Reviewed today</Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(m)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Training evidence ───────────────────────────────────────────

function Training() {
  const [data, setData] = useState<{ totalUsers: number; completedTraining: number; completionRate: number; staff: TrainingRow[] } | null>(null);
  useEffect(() => {
    api.get<typeof data>('/api/v1/compliance/training').then(setData)
      .catch((err: unknown) => logger.error('Failed to load training', err));
  }, []);
  if (!data) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Training evidence</CardTitle>
          <CardDescription>{data.completedTraining} of {data.totalUsers} staff trained ({data.completionRate}%)</CardDescription>
        </div>
        <Button variant="outline" size="sm" className="print:hidden" onClick={() => downloadCsv('/api/v1/compliance/training?format=csv', 'training-evidence.csv')}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={data.completionRate} aria-label={`${data.completionRate}% of staff trained`} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Certificate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.staff.map((s) => (
              <TableRow key={s.userId}>
                <TableCell>
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">{s.email}</span>
                </TableCell>
                <TableCell>{s.department ?? '—'}</TableCell>
                <TableCell>{s.trained ? fmtDate(s.completedAt) : <Badge variant="outline">Not trained</Badge>}</TableCell>
                <TableCell className="font-mono text-xs">{s.certificateNumber ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Audit trail ─────────────────────────────────────────────────

const AUDIT_FILTERS: Record<string, string> = {
  all: 'All events', assessment: 'Assessments', keypass: 'Key-passes', risk_register: 'Risk register',
  compliance: 'Compliance', purchase: 'Purchases', api_key: 'API keys', webhook_endpoint: 'Webhooks',
};

function AuditTrail() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 25;

  useEffect(() => {
    const type = filter === 'all' ? '' : `&eventType=${encodeURIComponent(filter)}`;
    api.get<AuditEvent[]>(`/api/v1/compliance/audit-trail?page=${page}&pageSize=${PAGE_SIZE}${type}`)
      .then((rows) => { setEvents(rows); setHasMore(rows.length === PAGE_SIZE); })
      .catch((err: unknown) => logger.error('Failed to load audit trail', err));
  }, [page, filter]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Audit trail</CardTitle>
          <CardDescription>Every assessment, review and configuration change, with who made it and when.</CardDescription>
        </div>
        <div className="flex gap-2 print:hidden">
          <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44" aria-label="Filter audit events"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(AUDIT_FILTERS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => downloadCsv('/api/v1/compliance/audit-trail?format=csv', 'audit-trail.csv')}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No events.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Resource</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{new Date(e.createdAt).toLocaleString('en-GB')}</TableCell>
                  <TableCell className="font-mono text-xs">{e.eventType}</TableCell>
                  <TableCell>{e.actorEmail ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{[e.resourceType, e.resourceId].filter(Boolean).join(' · ') || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="flex justify-between mt-4 print:hidden">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page}</span>
          <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Exports ─────────────────────────────────────────────────────

const EXPORTS: { dataset: string; label: string; description: string }[] = [
  { dataset: 'assessments', label: 'Assessments', description: 'Every assessment with status, dates and risk level' },
  { dataset: 'risk_register', label: 'Risk register', description: 'Risks, scores, owners and action plans' },
  { dataset: 'training', label: 'Training', description: 'Training completion and certificate numbers' },
  { dataset: 'incidents', label: 'Incidents', description: 'Incident log with resolutions' },
  { dataset: 'senior_management', label: 'Senior management', description: 'Accountable managers and review dates' },
  { dataset: 'keypasses', label: 'Key-passes', description: 'Issued key-passes (codes masked)' },
];

function Exports() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Auditor and GDPR exports</CardTitle>
        <CardDescription>Download your organisation's records as CSV for auditors, regulators or subject access requests.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {EXPORTS.map((e) => (
          <div key={e.dataset} className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="font-medium">{e.label}</p>
              <p className="text-sm text-muted-foreground">{e.description}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(`/api/v1/compliance/export?format=csv&dataset=${e.dataset}`, `compliance-${e.dataset}.csv`)}
              aria-label={`Download ${e.label} CSV`}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────

const COMPLIANCE_TABS = ['overview', 'gaps', 'incidents', 'senior', 'training', 'audit', 'exports'];

export default function Compliance() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const requested = searchParams.get('tab') ?? '';
    return COMPLIANCE_TABS.includes(requested) ? requested : 'overview';
  });

  const loadReport = useCallback(() => {
    api.get<Report>('/api/v1/compliance/report')
      .then((r) => { setReport(r); setError(null); })
      .catch((err: unknown) => {
        logger.error('Failed to load compliance report', err);
        setError(err instanceof ApiError ? err.message : 'Failed to load the compliance report');
      });
  }, []);

  useEffect(() => {
    loadReport();
    api.get<Employee[]>('/api/v1/analytics/employees?pageSize=200').then(setEmployees)
      .catch((err: unknown) => logger.warn('Could not load staff list', err));
  }, [loadReport]);

  const printReport = () => {
    setTab('overview');
    // Let the overview render before opening the print dialog
    setTimeout(() => window.print(), 50);
  };

  return (
    <Layout>
      <div className="container py-8 lg:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Compliance</h1>
            <p className="text-muted-foreground">
              ECCTA 2023 and GovS 013 position{report ? ` · generated ${new Date(report.generatedAt).toLocaleString('en-GB')}` : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={printReport} className="print:hidden" disabled={!report}>
            <Printer className="mr-2 h-4 w-4" aria-hidden="true" /> Print board report
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 mb-6">
            <CardContent className="pt-6 flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" /> {error}
            </CardContent>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 flex-wrap h-auto print:hidden">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="gaps">Gaps</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="senior">Senior management</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
            <TabsTrigger value="audit">Audit trail</TabsTrigger>
            <TabsTrigger value="exports">Exports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {report ? <Overview report={report} /> : !error && <Skeleton className="h-96 w-full" />}
          </TabsContent>
          <TabsContent value="gaps"><Gaps /></TabsContent>
          <TabsContent value="incidents"><Incidents onChange={loadReport} /></TabsContent>
          <TabsContent value="senior"><SeniorManagement employees={employees} onChange={loadReport} /></TabsContent>
          <TabsContent value="training"><Training /></TabsContent>
          <TabsContent value="audit"><AuditTrail /></TabsContent>
          <TabsContent value="exports"><Exports /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
