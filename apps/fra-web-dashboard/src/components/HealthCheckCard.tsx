import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Download, Loader2, PlayCircle, ArrowRight, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import type { Entitlements } from '@/hooks/useEntitlements';
import { describeAllowance } from '@/lib/assessmentAllowance';
import type { AssessmentRecord } from '@/types/assessment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const logger = createLogger('HealthCheckCard');

const OPEN = new Set<AssessmentRecord['status']>(['draft', 'in_progress']);

interface HealthCheckCardProps {
  entitlements: Entitlements | null;
}

/**
 * The fraud risk health check (assessment, results and PDF report) is part of every
 * package — Starter, Professional and Enterprise — so it is shown to all of them.
 */
export function HealthCheckCard({ entitlements }: HealthCheckCardProps) {
  const [assessments, setAssessments] = useState<AssessmentRecord[] | null>(null);
  const [downloading, setDownloading] = useState(false);
  const included = !!entitlements?.features.assessment;

  useEffect(() => {
    if (!included) return;
    let cancelled = false;
    api
      .get<AssessmentRecord[]>('/api/v1/assessments?pageSize=50')
      .then((rows) => { if (!cancelled) setAssessments(rows); })
      .catch((err: unknown) => {
        logger.error('Failed to load assessments', err);
        if (!cancelled) setAssessments([]);
      });
    return () => { cancelled = true; };
  }, [included]);

  const header = (
    <CardHeader>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-lg">Fraud Risk Health Check</CardTitle>
            <CardDescription>Assess your organisation&apos;s fraud risks and get a scored report</CardDescription>
          </div>
        </div>
        {included && <Badge variant="secondary">Included in {entitlements?.packageName}</Badge>}
      </div>
    </CardHeader>
  );

  if (!included) {
    return (
      <Card>
        {header}
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Included in every package, from Starter upwards.</p>
          <Button variant="outline" asChild>
            <Link to="/package/starter">See packages</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (assessments === null) {
    return (
      <Card>
        {header}
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your assessments…
        </CardContent>
      </Card>
    );
  }

  const latest = [...assessments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const open = assessments.find((a) => OPEN.has(a.status));
  const finished = [...assessments]
    .filter((a) => !OPEN.has(a.status))
    .sort((a, b) => (b.submittedAt ?? b.updatedAt).localeCompare(a.submittedAt ?? a.updatedAt))[0];
  const canStartNew = !!entitlements?.assessments.allowed;

  const downloadReport = async (id: string) => {
    setDownloading(true);
    try {
      await api.download(`/api/v1/assessments/${id}/export-pdf`, 'fraud-risk-assessment-report.pdf');
    } catch (err: unknown) {
      logger.error('Report download failed', err);
      toast.error('The report could not be downloaded. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      {header}
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {latest
            ? `Latest: ${latest.title || 'Fraud risk assessment'} — ${OPEN.has(latest.status) ? 'in progress' : 'completed'}`
            : 'You have not started a health check yet.'}
          {' · '}
          {describeAllowance(entitlements!.assessments)}
        </p>
        <div className="flex flex-wrap gap-3">
          {open ? (
            <Button asChild>
              <Link to="/assessment"><ArrowRight className="mr-2 h-4 w-4" aria-hidden="true" />Continue health check</Link>
            </Button>
          ) : canStartNew ? (
            <Button asChild>
              <Link to="/assessment">
                <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                {finished ? 'Start a new assessment' : 'Start your health check'}
              </Link>
            </Button>
          ) : null}
          {finished && (
            <>
              <Button variant="outline" asChild>
                <Link to={`/assessment/${finished.id}/results`}><BarChart3 className="mr-2 h-4 w-4" aria-hidden="true" />View results</Link>
              </Button>
              <Button variant="outline" onClick={() => downloadReport(finished.id)} disabled={downloading}>
                {downloading
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}
                Download PDF report
              </Button>
            </>
          )}
        </div>
        {!open && !canStartNew && entitlements?.assessments.reason && (
          <p className="text-sm text-muted-foreground">{entitlements.assessments.reason}</p>
        )}
      </CardContent>
    </Card>
  );
}
