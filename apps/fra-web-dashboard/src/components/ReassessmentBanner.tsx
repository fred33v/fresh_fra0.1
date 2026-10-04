import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const logger = createLogger('ReassessmentBanner');

interface ReassessmentStatus {
  status: 'not_applicable' | 'not_started' | 'ok' | 'due_soon' | 'overdue';
  dueAt: string | null;
  daysUntilDue: number | null;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** Prompts the organisation to reassess each quarter (Professional and Enterprise); silent otherwise. */
export function ReassessmentBanner() {
  const [s, setS] = useState<ReassessmentStatus | null>(null);

  useEffect(() => {
    api.get<ReassessmentStatus>('/api/v1/assessments/reassessment')
      .then(setS)
      .catch((err: unknown) => logger.warn('Could not load reassessment status', err));
  }, []);

  if (!s || (s.status !== 'due_soon' && s.status !== 'overdue' && s.status !== 'not_started')) return null;

  const overdue = s.status === 'overdue';
  const title = s.status === 'not_started'
    ? 'Complete your first fraud risk assessment'
    : overdue ? 'Your quarterly reassessment is overdue' : 'Your quarterly reassessment is due soon';
  const detail = s.status === 'not_started'
    ? 'Your package includes a reassessment every quarter, starting from your first assessment.'
    : overdue
      ? `It was due on ${fmtDate(s.dueAt!)}. Regular reassessment is part of the monitoring and review the ECCTA guidance expects.`
      : `It is due on ${fmtDate(s.dueAt!)}, in ${s.daysUntilDue} day${s.daysUntilDue === 1 ? '' : 's'}.`;

  return (
    <Alert variant={overdue ? 'destructive' : 'default'} className="mb-8" role="status">
      <CalendarClock className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{detail}</span>
        <Button size="sm" asChild><Link to="/assessment">{s.status === 'not_started' ? 'Start assessment' : 'Start reassessment'}</Link></Button>
      </AlertDescription>
    </Alert>
  );
}
