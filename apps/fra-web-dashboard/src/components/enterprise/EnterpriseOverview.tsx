import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RiskHeatMap } from '@/components/enterprise/RiskHeatMap';
import { StatusLabel, type ComplianceStatus } from '@/components/enterprise/ComplianceStatus';
import { AlertTriangle, ArrowRight, CheckCircle2, KeyRound, Plug, RefreshCw, Webhook } from 'lucide-react';

const logger = createLogger('EnterpriseOverview');

// Quarterly reassessment is part of Professional and Enterprise (see data/packages.ts)
const REASSESSMENT_DAYS = 90;
// ECCTA principle 5 is "met" from 80% staff training coverage (backend compliance-evidence.ts)
const TRAINING_TARGET = 80;

interface Requirement { id: string; name: string; status: ComplianceStatus; evidence: string; recommendation?: string }
interface Framework { score: number; requirements: Requirement[] }
interface Report {
  generatedAt: string;
  eccta2023: Framework;
  govs013: Framework;
  metrics: {
    employees: number; assessmentCoverage: number; trainingCoverage: number; latestAssessmentAt: string | null;
    openSeriousIncidents: number; openIncidents: number;
  };
  topRiskAreas: { area: string; employeesFlagged: number; highestPriority: 'high' | 'medium' | 'low' }[];
}
interface RiskSummary {
  total: number;
  byPriority: { HIGH: number; MEDIUM: number; LOW: number };
  overdue: number;
  unowned: number;
  heatMap: number[][];
}
interface Gap { framework: string; requirementId: string; requirement: string; priority: 'CRITICAL' | 'HIGH' | 'MEDIUM'; recommendation: string }
interface ApiKey { id: string; revokedAt?: string; lastUsedAt?: string }
interface WebhookEndpoint { id: string; isActive: boolean; lastDeliveryStatus?: number }

export interface OverviewEmployee {
  userId: string;
  department: string | null;
  status: 'completed' | 'in-progress' | 'not-started';
  riskLevel: 'high' | 'medium' | 'low' | null;
}

type Section<T> = { data: T | null; error: boolean };
const empty = <T,>(): Section<T> => ({ data: null, error: false });

function apply<T>(res: PromiseSettledResult<T>, name: string, set: Dispatch<SetStateAction<Section<T>>>) {
  if (res.status === 'fulfilled') {
    set({ data: res.value, error: false });
    return;
  }
  logger.warn(`Could not load ${name}`, res.reason);
  // Keep the last good data during live refresh; only flag the section as failed
  set((prev) => ({ data: prev.data, error: true }));
}

interface AttentionItem {
  key: string;
  severity: 'high' | 'medium';
  text: string;
  detail?: string;
  action: { label: string; to?: string; onClick?: () => void };
}

interface Props {
  employees: OverviewEmployee[];
  /** Incremented by the dashboard on every refresh (manual or live). */
  refreshSignal: number;
  onShowEmployees: (filter: { risk?: 'high'; department?: string }) => void;
}

export function EnterpriseOverview({ employees, refreshSignal, onShowEmployees }: Props) {
  const [report, setReport] = useState<Section<Report>>(empty);
  const [risks, setRisks] = useState<Section<RiskSummary>>(empty);
  const [gaps, setGaps] = useState<Section<Gap[]>>(empty);
  const [keys, setKeys] = useState<Section<ApiKey[]>>(empty);
  const [hooks, setHooks] = useState<Section<WebhookEndpoint[]>>(empty);
  const [loaded, setLoaded] = useState(false);

  // Each source loads independently, so one failing service never blanks the whole overview
  const load = useCallback(async () => {
    const [r, s, g, k, w] = await Promise.allSettled([
      api.get<Report>('/api/v1/compliance/report'),
      api.get<RiskSummary>('/api/v1/risk-register/summary'),
      api.get<{ gaps: Gap[] }>('/api/v1/compliance/gap-analysis'),
      api.get<ApiKey[]>('/api/v1/api-keys'),
      api.get<WebhookEndpoint[]>('/api/v1/webhook-endpoints'),
    ]);
    apply(r, 'compliance report', setReport);
    apply(s, 'risk register summary', setRisks);
    apply<Gap[]>(g.status === 'fulfilled' ? { status: 'fulfilled', value: g.value.gaps } : g, 'gap analysis', setGaps);
    apply(k, 'API keys', setKeys);
    apply(w, 'webhook endpoints', setHooks);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load, refreshSignal]);

  const departments = useMemo(() => {
    const byDept = new Map<string, { staff: number; completed: number; high: number; medium: number }>();
    for (const e of employees) {
      const name = e.department || 'General';
      const row = byDept.get(name) ?? { staff: 0, completed: 0, high: 0, medium: 0 };
      row.staff += 1;
      if (e.status === 'completed') row.completed += 1;
      if (e.riskLevel === 'high') row.high += 1;
      if (e.riskLevel === 'medium') row.medium += 1;
      byDept.set(name, row);
    }
    return Array.from(byDept, ([name, r]) => ({ name, ...r, completion: Math.round((r.completed / r.staff) * 100) }))
      .sort((a, b) => b.high - a.high || a.completion - b.completion);
  }, [employees]);

  const highRiskStaff = employees.filter((e) => e.riskLevel === 'high').length;

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const s = risks.data;
    const m = report.data?.metrics;
    if (s?.overdue) items.push({ key: 'overdue', severity: 'high', text: `${s.overdue} risk action${s.overdue === 1 ? ' is' : 's are'} past the due date`, action: { label: 'Open risk register', to: '/risk-register' } });
    if (m?.openSeriousIncidents) items.push({ key: 'incidents', severity: 'high', text: `${m.openSeriousIncidents} serious incident${m.openSeriousIncidents === 1 ? ' is' : 's are'} still open`, action: { label: 'Review incidents', to: '/compliance?tab=incidents' } });
    for (const gap of (gaps.data ?? []).filter((x) => x.priority === 'CRITICAL').slice(0, 3)) {
      items.push({ key: `gap-${gap.requirementId}`, severity: 'high', text: `${gap.framework}: ${gap.requirement} is not met`, detail: gap.recommendation, action: { label: 'See gap', to: '/compliance?tab=gaps' } });
    }
    if (highRiskStaff) items.push({ key: 'staff', severity: 'high', text: `${highRiskStaff} employee${highRiskStaff === 1 ? '' : 's'} reported high fraud risk`, action: { label: 'Show employees', onClick: () => onShowEmployees({ risk: 'high' }) } });
    if (s?.unowned) items.push({ key: 'unowned', severity: 'medium', text: `${s.unowned} open risk${s.unowned === 1 ? ' has' : 's have'} no owner`, action: { label: 'Assign owners', to: '/risk-register' } });
    if (m && m.employees > 0) {
      const last = m.latestAssessmentAt ? Date.parse(m.latestAssessmentAt) : null;
      const days = last ? Math.floor((Date.now() - last) / 86_400_000) : null;
      if (days === null || days > REASSESSMENT_DAYS) {
        items.push({ key: 'reassess', severity: 'medium', text: days === null ? 'No fraud risk assessment has been submitted yet' : `Quarterly reassessment is due (last one ${days} days ago)`, action: { label: 'Start assessment', to: '/assessment' } });
      }
      if (m.trainingCoverage < TRAINING_TARGET) items.push({ key: 'training', severity: 'medium', text: `${m.trainingCoverage}% of staff have completed fraud awareness training (target ${TRAINING_TARGET}%)`, action: { label: 'View training', to: '/compliance?tab=training' } });
    }
    return items;
  }, [risks.data, report.data, gaps.data, highRiskStaff, onShowEmployees]);

  if (!loaded) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const eccta = report.data?.eccta2023;
  const principlesMet = eccta?.requirements.filter((r) => r.status === 'met').length ?? 0;
  const anyFailed = [report, risks, gaps, keys, hooks].some((x) => x.error);

  return (
    <div className="space-y-6">
      {anyFailed && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40" role="status">
          <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-amber-900 dark:text-amber-200">Some sections couldn't be updated. The rest of the overview is current.</p>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Headline position: the numbers a board asks for first */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="ECCTA 2023 readiness"
          value={eccta ? `${eccta.score}%` : '—'}
          note={eccta ? `${principlesMet} of ${eccta.requirements.length} principles met` : 'Compliance report unavailable'}
          to="/compliance"
        />
        <Kpi
          title="GovS 013 alignment"
          value={report.data ? `${report.data.govs013.score}%` : '—'}
          note="Government Functional Standard"
          to="/compliance"
        />
        <Kpi
          title="Open high risks"
          value={risks.data ? String(risks.data.byPriority.HIGH) : '—'}
          note={risks.data ? `${risks.data.overdue} overdue · ${risks.data.unowned} without an owner` : 'Risk register unavailable'}
          tone={risks.data && risks.data.byPriority.HIGH > 0 ? 'danger' : undefined}
          to="/risk-register"
        />
        <Kpi
          title="Staff coverage"
          value={report.data ? `${report.data.metrics.assessmentCoverage}%` : '—'}
          note={report.data ? `assessed · ${report.data.metrics.trainingCoverage}% trained` : 'Coverage unavailable'}
          to="/compliance?tab=training"
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Needs attention</CardTitle>
            <CardDescription>Ordered by severity. Each item links to where it's resolved.</CardDescription>
          </CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Nothing needs attention right now.
              </p>
            ) : (
              <ul className="divide-y">
                {[...attention].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1)).map((item) => (
                  <li key={item.key} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex gap-2 min-w-0">
                      <AlertTriangle
                        className={`h-4 w-4 shrink-0 mt-0.5 ${item.severity === 'high' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}
                        aria-label={item.severity === 'high' ? 'High priority' : 'Medium priority'}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.text}</p>
                        {item.detail && <p className="text-sm text-muted-foreground">{item.detail}</p>}
                      </div>
                    </div>
                    {item.action.to ? (
                      <Button variant="outline" size="sm" asChild><Link to={item.action.to}>{item.action.label}</Link></Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={item.action.onClick}>{item.action.label}</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Risk heat map</CardTitle>
              <CardDescription>Open register risks, impact (rows) × likelihood (columns)</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild><Link to="/risk-register" aria-label="Open risk register">Open <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" /></Link></Button>
          </CardHeader>
          <CardContent>
            {risks.data ? (
              risks.data.total > 0 ? <RiskHeatMap heatMap={risks.data.heatMap} /> : (
                <p className="text-sm text-muted-foreground">
                  The risk register is empty. Record the risks your assessments identified, with owners and controls.
                </p>
              )
            ) : <SectionUnavailable onRetry={load} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">ECCTA 2023: the six principles</CardTitle>
              <CardDescription>Evidence for the "reasonable procedures" defence</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild><Link to="/compliance" aria-label="Open compliance evidence">Evidence <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" /></Link></Button>
          </CardHeader>
          <CardContent>
            {eccta ? (
              <ul className="space-y-3">
                {eccta.requirements.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.recommendation ?? r.evidence}</p>
                    </div>
                    <span className="shrink-0"><StatusLabel status={r.status} /></span>
                  </li>
                ))}
              </ul>
            ) : <SectionUnavailable onRetry={load} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Department scorecard</CardTitle>
            <CardDescription>Select a department to see its employees</CardDescription>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees yet. Issue key-passes to invite staff.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Staff</TableHead>
                    <TableHead className="text-right">Assessed</TableHead>
                    <TableHead className="text-right">High risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.slice(0, 8).map((d) => (
                    <TableRow key={d.name}>
                      <TableCell>
                        <button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => onShowEmployees({ department: d.name })}>
                          {d.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{d.staff}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.completion}%</TableCell>
                      <TableCell className={`text-right tabular-nums ${d.high > 0 ? 'font-semibold text-red-700 dark:text-red-400' : ''}`}>{d.high}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {departments.length > 8 && (
              <p className="mt-2 text-xs text-muted-foreground">Showing the 8 departments that need the most attention, out of {departments.length}.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top risk areas from assessments</CardTitle>
            <CardDescription>Where employees' answers point to fraud exposure</CardDescription>
          </CardHeader>
          <CardContent>
            {!report.data ? <SectionUnavailable onRetry={load} /> : report.data.topRiskAreas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assessed risk areas yet. They appear once employees submit assessments.</p>
            ) : (
              <ul className="space-y-2">
                {report.data.topRiskAreas.map((a) => (
                  <li key={a.area} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{a.area}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {a.employeesFlagged} flagged · <span className={a.highestPriority === 'high' ? 'text-red-700 dark:text-red-400 font-medium' : ''}>{a.highestPriority}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Integrations</CardTitle>
              <CardDescription>API access and outgoing webhooks for your GRC or SIEM tools</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild><Link to="/integrations" aria-label="Manage integrations">Manage <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" /></Link></Button>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <IntegrationStat
              icon={KeyRound}
              label="Active API keys"
              value={keys.data ? keys.data.filter((k) => !k.revokedAt).length : null}
              note={keys.data && keys.data.some((k) => k.lastUsedAt) ? 'In use' : 'Not used yet'}
            />
            <IntegrationStat
              icon={Webhook}
              label="Active webhooks"
              value={hooks.data ? hooks.data.filter((h) => h.isActive).length : null}
              note={hooks.data && hooks.data.some((h) => h.lastDeliveryStatus && h.lastDeliveryStatus >= 400) ? 'Last delivery failed' : 'Healthy'}
              warn={!!hooks.data?.some((h) => h.lastDeliveryStatus && h.lastDeliveryStatus >= 400)}
            />
          </CardContent>
        </Card>
      </div>

      {report.data && (
        <p className="text-xs text-muted-foreground">
          Compliance position generated {new Date(report.data.generatedAt).toLocaleString('en-GB')}. Self-assessment indicators from records held in FRAUD-RISK.CO.UK; they support, but don't replace, legal advice or a formal GovS 013 assurance review.
        </p>
      )}
    </div>
  );
}

function Kpi({ title, value, note, to, tone }: { title: string; value: string; note: string; to: string; tone?: 'danger' }) {
  return (
    <Link to={to} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold tabular-nums ${tone === 'danger' ? 'text-red-700 dark:text-red-400' : ''}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{note}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function IntegrationStat({ icon: Icon, label, value, note, warn }: { icon: typeof Plug; label: string; value: number | null; note: string; warn?: boolean }) {
  return (
    <div className="flex gap-3">
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
      <div>
        <p className="text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value ?? '—'}</p>
        <p className={`text-xs ${warn ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>{value === null ? 'Unavailable' : note}</p>
      </div>
    </div>
  );
}

function SectionUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>This section couldn't load.</span>
      <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="mr-2 h-3 w-3" aria-hidden="true" />Retry</Button>
    </div>
  );
}
