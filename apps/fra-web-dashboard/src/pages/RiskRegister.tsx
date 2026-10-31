import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Check, Download, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { RISK_AREA_LABELS, riskAreaLabel, scoreRisk, type ControlEffectiveness, type Priority } from '@/lib/risk-scoring';
import { RiskHeatMap } from '@/components/enterprise/RiskHeatMap';
import { ImportFromAssessment } from '@/components/enterprise/ImportFromAssessment';
import { useConfirm } from '@/hooks/useConfirm';

const logger = createLogger('RiskRegister');

type RiskStatus = 'open' | 'in_progress' | 'mitigated' | 'accepted' | 'closed';

export interface Risk {
  id: string;
  title: string;
  riskArea: string;
  description?: string;
  impact: number;
  likelihood: number;
  controlEffectiveness: ControlEffectiveness;
  controls?: string;
  inherentScore: number;
  residualScore: number;
  priority: Priority;
  ownerUserId?: string;
  actionPlan?: string;
  dueDate?: string;
  status: RiskStatus;
  /** The owner's latest word on their action, from their own dashboard */
  ownerNote?: string;
  ownerUpdatedAt?: string;
  /** The owner marked it done and the employer has not confirmed it yet */
  reviewPending?: boolean;
}

interface Summary {
  total: number;
  byPriority: Record<Priority, number>;
  overdue: number;
  unowned: number;
  awaitingReview?: number;
  heatMap: number[][]; // [impact-1][likelihood-1]
}

interface Employee { userId: string; userName: string }

const CONTROL_LABELS: Record<ControlEffectiveness, string> = {
  very_strong: 'Very strong (−40%)',
  reasonably_strong: 'Reasonably strong (−20%)',
  some_gaps: 'Some gaps',
  weak: 'Weak',
  none: 'None',
};
const STATUS_LABELS: Record<RiskStatus, string> = {
  open: 'Open', in_progress: 'In progress', mitigated: 'Mitigated', accepted: 'Accepted', closed: 'Closed',
};
const RISK_AREAS = Object.keys(RISK_AREA_LABELS);
const TO_CONFIRM = 'to_confirm';

const PRIORITY_CLASS: Record<Priority, string> = {
  HIGH: 'bg-destructive/10 text-destructive border-destructive/30',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
};

type FormState = {
  title: string; riskArea: string; description: string; impact: number; likelihood: number;
  controlEffectiveness: ControlEffectiveness; controls: string; ownerUserId: string;
  actionPlan: string; dueDate: string; status: RiskStatus;
};

const EMPTY_FORM: FormState = {
  title: '', riskArea: 'procurement', description: '', impact: 3, likelihood: 3,
  controlEffectiveness: 'some_gaps', controls: '', ownerUserId: '', actionPlan: '', dueDate: '', status: 'open',
};

const NO_OWNER = '__none__';

export default function RiskRegister() {
  const confirm = useConfirm();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<Risk | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const [riskData, summaryData] = await Promise.all([
        api.get<Risk[]>('/api/v1/risk-register'),
        api.get<Summary>('/api/v1/risk-register/summary'),
      ]);
      setRisks(riskData);
      setSummary(summaryData);
    } catch (err: unknown) {
      logger.error('Failed to load risk register', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load the risk register');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get<Employee[]>('/api/v1/analytics/employees?pageSize=100')
      .then(setEmployees)
      .catch((err: unknown) => logger.warn('Could not load owners', err));
  }, []);

  const ownerName = (id?: string) => employees.find((e) => e.userId === id)?.userName ?? (id ? 'Unknown' : '—');

  const filtered = useMemo(() => risks.filter((r) =>
    (priorityFilter === 'all' || r.priority === priorityFilter) &&
    (statusFilter === 'all' || (statusFilter === TO_CONFIRM ? !!r.reviewPending : r.status === statusFilter))
  ), [risks, priorityFilter, statusFilter]);

  const preview = scoreRisk(form.impact, form.likelihood, form.controlEffectiveness);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (risk: Risk) => {
    setEditing(risk);
    setForm({
      title: risk.title, riskArea: risk.riskArea, description: risk.description ?? '',
      impact: risk.impact, likelihood: risk.likelihood, controlEffectiveness: risk.controlEffectiveness,
      controls: risk.controls ?? '', ownerUserId: risk.ownerUserId ?? '', actionPlan: risk.actionPlan ?? '',
      dueDate: risk.dueDate ?? '', status: risk.status,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      setFormError('Enter a title for the risk');
      return;
    }
    setIsSaving(true);
    const body = {
      title: form.title.trim(),
      riskArea: form.riskArea,
      description: form.description || undefined,
      impact: form.impact,
      likelihood: form.likelihood,
      controlEffectiveness: form.controlEffectiveness,
      controls: form.controls || undefined,
      ownerUserId: form.ownerUserId || null,
      actionPlan: form.actionPlan || undefined,
      dueDate: form.dueDate || null,
      status: form.status,
    };
    try {
      if (editing) {
        await api.patch(`/api/v1/risk-register/${editing.id}`, body);
        toast.success('Risk updated');
      } else {
        await api.post('/api/v1/risk-register', body);
        toast.success('Risk added');
      }
      setDialogOpen(false);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save risk');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (risk: Risk) => {
    if (!(await confirm({ title: `Delete "${risk.title}" from the risk register?`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await api.delete(`/api/v1/risk-register/${risk.id}`);
      toast.success('Risk deleted');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete risk');
    }
  };

  // The owner said it is done: confirm it, or send it back to them
  const review = async (risk: Risk, decision: 'approve' | 'reopen') => {
    try {
      await api.post(`/api/v1/risk-register/${risk.id}/review`, { decision });
      toast.success(decision === 'approve' ? 'Action confirmed' : 'Sent back to the owner');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save your decision');
    }
  };

  const exportCsv = async () => {
    try {
      await api.download('/api/v1/risk-register?format=csv', 'risk-register.csv');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'title') setFormError(null);
  };

  return (
    <Layout>
      <div className="container py-8 lg:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Risk register</h1>
            <p className="text-muted-foreground">Organisation fraud risks, owners and remediation</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Export CSV
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Add risk
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 mb-6">
            <CardContent className="pt-6 flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" /> {error}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <ImportFromAssessment onImported={load} />
            {summary && (
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] mb-8">
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 content-start">
                  {[
                    { label: 'Active risks', value: summary.total },
                    { label: 'High priority', value: summary.byPriority.HIGH },
                    { label: 'Overdue actions', value: summary.overdue },
                    { label: 'Without an owner', value: summary.unowned },
                    { label: 'Done, to confirm', value: summary.awaitingReview ?? 0 },
                  ].map((s) => (
                    <Card key={s.label}>
                      <CardHeader className="pb-2">
                        <CardDescription>{s.label}</CardDescription>
                      </CardHeader>
                      <CardContent><p className="text-3xl font-semibold">{s.value}</p></CardContent>
                    </Card>
                  ))}
                </div>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Inherent risk heat map</CardTitle>
                    <CardDescription>Impact (rows) × likelihood (columns)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RiskHeatMap heatMap={summary.heatMap} />
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
                <CardTitle className="text-lg">Risks ({filtered.length})</CardTitle>
                <div className="flex gap-2">
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-36" aria-label="Filter by priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value={TO_CONFIRM}>Done, to confirm</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">
                    {risks.length === 0 ? 'No risks recorded yet. Add your first risk to start the register.' : 'No risks match these filters.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Risk</TableHead>
                          <TableHead className="text-right">Inherent</TableHead>
                          <TableHead className="text-right">Residual</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <p className="font-medium">{r.title}</p>
                              <p className="text-xs text-muted-foreground">{riskAreaLabel(r.riskArea)}</p>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{r.inherentScore}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.residualScore}</TableCell>
                            <TableCell><Badge variant="outline" className={PRIORITY_CLASS[r.priority]}>{r.priority}</Badge></TableCell>
                            <TableCell className="max-w-xs">
                              <p>{STATUS_LABELS[r.status]}</p>
                              {r.reviewPending && <Badge variant="secondary" className="mt-1">Done, to confirm</Badge>}
                              {r.ownerNote && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Owner{r.ownerUpdatedAt ? ` (${r.ownerUpdatedAt.slice(0, 10)})` : ''}: {r.ownerNote}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>{ownerName(r.ownerUserId)}</TableCell>
                            <TableCell className="tabular-nums">{r.dueDate ?? '—'}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {r.reviewPending && (<>
                                <Button variant="ghost" size="icon" onClick={() => review(r, 'approve')} aria-label={`Confirm ${r.title} is done`}>
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => review(r, 'reopen')} aria-label={`Send ${r.title} back to its owner`}>
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </>)}
                              <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label={`Edit ${r.title}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => remove(r)} aria-label={`Delete ${r.title}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit risk' : 'Add risk'}</DialogTitle>
              <DialogDescription>Scores are calculated from impact, likelihood and control strength.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="risk-title">Title</Label>
                <Input id="risk-title" value={form.title} onChange={(e) => set('title', e.target.value)} aria-invalid={!!formError} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-risk-area">Risk area</Label>
                <Select value={form.riskArea} onValueChange={(v) => set('riskArea', v)}>
                  <SelectTrigger id="risk-risk-area"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RISK_AREAS.map((a) => <SelectItem key={a} value={a}>{riskAreaLabel(a)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v as RiskStatus)}>
                  <SelectTrigger id="risk-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-impact-1-5">Impact (1–5)</Label>
                <Select value={String(form.impact)} onValueChange={(v) => set('impact', Number(v))}>
                  <SelectTrigger id="risk-impact-1-5"><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-likelihood-1-5">Likelihood (1–5)</Label>
                <Select value={String(form.likelihood)} onValueChange={(v) => set('likelihood', Number(v))}>
                  <SelectTrigger id="risk-likelihood-1-5"><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-control-effectiveness">Control effectiveness</Label>
                <Select value={form.controlEffectiveness} onValueChange={(v) => set('controlEffectiveness', v as ControlEffectiveness)}>
                  <SelectTrigger id="risk-control-effectiveness"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTROL_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border p-3 text-sm flex items-center gap-3" aria-live="polite">
                <span>Inherent <strong>{preview.inherentScore}</strong></span>
                <span>Residual <strong>{preview.residualScore}</strong></span>
                <Badge variant="outline" className={PRIORITY_CLASS[preview.priority]}>{preview.priority}</Badge>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-owner">Owner</Label>
                <Select value={form.ownerUserId || NO_OWNER} onValueChange={(v) => set('ownerUserId', v === NO_OWNER ? '' : v)}>
                  <SelectTrigger id="risk-owner"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_OWNER}>No owner</SelectItem>
                    {employees.map((e) => <SelectItem key={e.userId} value={e.userId}>{e.userName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-due">Due date</Label>
                <Input id="risk-due" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="risk-controls">Existing controls</Label>
                <Textarea id="risk-controls" rows={2} value={form.controls} onChange={(e) => set('controls', e.target.value)} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="risk-action">Action plan</Label>
                <Textarea id="risk-action" rows={2} value={form.actionPlan} onChange={(e) => set('actionPlan', e.target.value)} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="risk-description">Description</Label>
                <Textarea id="risk-description" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>
            </div>

            {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={isSaving}>{isSaving ? 'Saving…' : editing ? 'Save changes' : 'Add risk'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
