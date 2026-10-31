import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BUDGET_HOLDER_STATUS_LABEL, type BudgetHolderStatus } from '@/lib/budget-holder';

const logger = createLogger('TeamTraining');

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  emailConfirmed: boolean;
  training: {
    status: 'completed' | 'in_progress' | 'not_started';
    modulesDone: number;
    totalModules: number;
    quizAverage: number | null;
    completedAt: string | null;
    lastActivityAt: string | null;
  };
  certificate: { number: string; issuedAt: string } | null;
  actionPlan: { done: number; total: number } | null;
  /** Enterprise only: the budget holder programme */
  budgetHolder?: { required: boolean; status: BudgetHolderStatus } | null;
}

export interface TeamTrainingData {
  summary: { people: number; trained: number; certificates: number; pendingInvitations: number };
  people: TeamMember[];
  invitations: Array<{ code: string; email: string; invitedAt: string; expiresAt: string; expired: boolean }>;
}

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const TRAINING_LABEL: Record<TeamMember['training']['status'], string> = {
  completed: 'Completed', in_progress: 'In progress', not_started: 'Not started',
};

/**
 * Professional and Enterprise: who has joined, how far each person is through the training,
 * their certificate and their action plan. The CSV is the employer's record that staff were trained.
 */
export function TeamTraining({ onInvite }: { onInvite?: () => void }) {
  const [data, setData] = useState<TeamTrainingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<TeamTrainingData>('/api/v1/team/training')
      .then(setData)
      .catch((err: unknown) => {
        logger.error('Failed to load team training', err);
        setError(err instanceof Error ? err.message : 'Failed to load your team');
      });
  }, []);

  const exportCsv = async () => {
    try {
      await api.download('/api/v1/team/training?format=csv', 'team-training.csv');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  if (error) return <p className="text-sm text-destructive" role="alert">{error}</p>;
  if (!data) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading your team" /></div>;

  const { summary } = data;
  const showBudgetHolder = data.people.some((p) => p.budgetHolder);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'People who joined', value: summary.people },
          { label: 'Training completed', value: summary.trained },
          { label: 'Certificates', value: summary.certificates },
          { label: 'Invitations not used yet', value: summary.pendingInvitations },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardDescription>{s.label}</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{s.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Team training</CardTitle>
            <CardDescription>Your record of who has been trained. Download it to keep as evidence.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={data.people.length === 0}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {data.people.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-muted-foreground">Nobody has joined yet. Invite your team by email from the Key-passes tab.</p>
              {onInvite && <Button size="sm" onClick={onInvite}>Invite your team</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Training</TableHead>
                    <TableHead>Quiz average</TableHead>
                    <TableHead>Certificate</TableHead>
                    <TableHead>Action plan</TableHead>
                    {showBudgetHolder && <TableHead>Budget holder</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.people.map((p) => (
                    <TableRow key={p.userId}>
                      <TableCell>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined {formatDate(p.joinedAt)}{!p.emailConfirmed && ' · email not confirmed yet'}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-40">
                        <Badge variant={p.training.status === 'completed' ? 'default' : 'outline'}>{TRAINING_LABEL[p.training.status]}</Badge>
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={(p.training.modulesDone / p.training.totalModules) * 100} className="h-1.5 w-24"
                            aria-label={`${p.training.modulesDone} of ${p.training.totalModules} modules`} />
                          <span className="text-xs tabular-nums">{p.training.modulesDone}/{p.training.totalModules}</span>
                        </div>
                        {p.training.completedAt && <p className="text-xs text-muted-foreground mt-1">Finished {formatDate(p.training.completedAt)}</p>}
                      </TableCell>
                      <TableCell className="tabular-nums">{p.training.quizAverage === null ? '—' : `${p.training.quizAverage}%`}</TableCell>
                      <TableCell>
                        {p.certificate ? (
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Award className="h-4 w-4 text-success" aria-hidden="true" />
                            <span className="font-mono text-xs">{p.certificate.number}</span>
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                        {p.certificate && <p className="text-xs text-muted-foreground">{formatDate(p.certificate.issuedAt)}</p>}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {p.actionPlan && p.actionPlan.total > 0 ? `${p.actionPlan.done} of ${p.actionPlan.total} done` : <span className="text-muted-foreground">Not started</span>}
                      </TableCell>
                      {showBudgetHolder && (
                        <TableCell className="text-sm">
                          {p.budgetHolder && (p.budgetHolder.required || p.budgetHolder.status !== 'not_started')
                            ? <>{BUDGET_HOLDER_STATUS_LABEL[p.budgetHolder.status]}{p.budgetHolder.required && <p className="text-xs text-muted-foreground">Required</p>}</>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {data.invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invited, not joined yet</CardTitle>
            <CardDescription>You can resend an invitation from the Key-passes tab.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {data.invitations.map((i) => (
                <li key={i.code} className="flex flex-wrap justify-between gap-2">
                  <span>{i.email}</span>
                  <span className="text-muted-foreground">
                    {i.expired ? 'Expired' : `Sent ${formatDate(i.invitedAt)}, valid until ${formatDate(i.expiresAt)}`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
