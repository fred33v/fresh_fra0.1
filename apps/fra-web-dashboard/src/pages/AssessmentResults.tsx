/**
 * Assessment Results Page
 * 
 * Displays fraud risk assessment results:
 * - Overall risk score and rating (Low, Medium, High, Critical)
 * - Risk breakdown by module/category
 * - Risk heat map
 * - Recommendations based on high-risk areas
 * - Option to download detailed report
 * - Action plan generation
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle,
  Download,
  ArrowRight,
  TrendingUp,
  Shield,
  AlertCircle,
  Loader2,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AssessmentResults as AssessmentResultsData } from '@/types/assessment';
import type { AssessmentCertificate } from '@/types/workshop';

type Impact = 'high' | 'medium' | 'low';

const APPETITE_RANK: Record<string, number> = { Low: 1, Medium: 2, High: 3 };

const SEVERITY_IMPACT: Record<AssessmentResultsData['topRisks'][number]['severity'], Impact> = {
  Critical: 'high',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
};

export default function AssessmentResults() {
  const { assessmentId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);

  const downloadReport = async () => {
    if (!assessmentId) return;
    setDownloading(true);
    try {
      await api.download(`/api/v1/assessments/${assessmentId}/export-pdf`, 'fraud-risk-assessment-report.pdf');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'The report could not be downloaded');
    } finally {
      setDownloading(false);
    }
  };
  // Every submitted assessment has its own verifiable certificate
  const [certificate, setCertificate] = useState<AssessmentCertificate | null>(null);
  const [downloadingCertificate, setDownloadingCertificate] = useState(false);

  const downloadCertificate = async () => {
    if (!certificate) return;
    setDownloadingCertificate(true);
    try {
      await api.download(
        `/api/v1/certificates/${encodeURIComponent(certificate.certificateNumber)}/pdf`,
        `certificate-${certificate.certificateNumber}.pdf`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'The certificate could not be downloaded');
    } finally {
      setDownloadingCertificate(false);
    }
  };

  const [results, setResults] = useState<AssessmentResultsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (!assessmentId || !user) return;

      try {
        const data = await api.get<AssessmentResultsData>(
          `/api/v1/assessments/${assessmentId}/results`
        );
        setResults(data);
      } catch (err: unknown) {
        const errorMsg = (err instanceof Error ? err.message : 'Failed to load results');
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
    // Only the person who filled it in and the organisation's managers get the certificate; others see no card
    if (assessmentId && user) {
      api.get<AssessmentCertificate>(`/api/v1/assessments/${assessmentId}/certificate`)
        .then(setCertificate)
        .catch(() => setCertificate(null));
    }
  }, [assessmentId, user]);

  if (!user || !profile) return null;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error || !results) {
    return (
      <Layout>
        <div className="container py-8">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error || 'Results not found'}</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const rating = results.riskLevel.toLowerCase();
  const topRisks = results.topRisks.map((r) => ({ ...r, impact: SEVERITY_IMPACT[r.severity] }));

  const getRiskColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      // Darker shades so the score and rating text reach 4.5:1 contrast (WCAG 1.4.3)
      case 'low': return 'text-green-800';
      case 'medium': return 'text-amber-800';
      case 'high': return 'text-orange-800';
      case 'critical': return 'text-destructive';
      default: return 'text-primary';
    }
  };

  const getRiskBgColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'low': return 'bg-success/10';
      case 'medium': return 'bg-warning/10';
      case 'high': return 'bg-orange-100';
      case 'critical': return 'bg-destructive/10';
      default: return 'bg-primary/10';
    }
  };

  return (
    <Layout>
      <div className="container py-8 lg:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Assessment Complete
          </h1>
          <p className="text-lg text-muted-foreground">
            Your fraud risk assessment has been analysed
          </p>
        </motion.div>

        {/* Overall Risk Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8"
        >
          <Card className={`border-2 ${getRiskBgColor(rating)}`}>
            <CardHeader>
              <CardTitle level={2} className="flex items-center gap-3">
                <Shield className="h-6 w-6" />
                Overall Risk Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                {/* Score circle */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative h-48 w-48">
                    <svg className="h-full w-full transform -rotate-90">
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-muted-foreground/20"
                      />
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray={`${(results.overallScore / 100) * 553} 553`}
                        className={`transition-all duration-1000 ${getRiskColor(rating)}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className={`text-5xl font-bold ${getRiskColor(rating)}`}>
                        {results.overallScore}
                      </div>
                      <div className="text-sm text-muted-foreground">out of 100</div>
                    </div>
                  </div>
                </div>

                {/* Rating details */}
                <div className="flex flex-col justify-center space-y-4">
                  <div>
                    <Badge
                      className={`text-lg px-4 py-2 capitalize ${getRiskColor(rating)} ${getRiskBgColor(rating)}`}
                    >
                      {rating} Risk
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">What this means:</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {rating === 'low' && (topRisks.length > 0
                        ? `Your overall fraud risk is low, but the assessment found ${topRisks.length} weakness${topRisks.length === 1 ? '' : 'es'} to address. Review the key risk factors below.`
                        : 'No significant weaknesses were found. Keep monitoring your controls and training staff regularly.')}
                      {rating === 'medium' &&
                        'Your organisation has some fraud prevention measures in place, but there are opportunities for improvement.'}
                      {rating === 'high' &&
                        'Your organisation has significant fraud risks that require immediate attention and remediation.'}
                      {rating === 'critical' &&
                        'Your organisation faces critical fraud risks. Urgent action is needed to strengthen controls.'}
                    </p>
                    {results.riskAppetite && (
                      <p className="text-sm leading-relaxed">
                        <span className="font-medium">Your stated risk appetite: {results.riskAppetite}.</span>{' '}
                        {APPETITE_RANK[results.riskLevel] > APPETITE_RANK[results.riskAppetite]
                          ? 'Your assessed risk is above what you said you can accept, so the areas below need action.'
                          : 'Your assessed risk is within what you said you can accept.'}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => navigate('/action-plan')}
                      className="flex-1"
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Create Action Plan
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={downloadReport} disabled={downloading}>
                      <Download className="mr-2 h-4 w-4" />
                      {downloading ? 'Preparing report…' : 'Download Report'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {certificate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <Card>
              <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <Award className="h-10 w-10 text-primary flex-none" aria-hidden="true" />
                <div className="flex-1">
                  <h2 className="font-semibold">Assessment certificate</h2>
                  <p className="text-sm text-muted-foreground">
                    Certificate <span className="font-mono">{certificate.certificateNumber}</span>, issued{' '}
                    {new Date(certificate.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                    It shows this assessment was carried out, not your results. Anyone can{' '}
                    <a href={`/certificate/verify?n=${encodeURIComponent(certificate.certificateNumber)}`} className="underline">check it is genuine</a>.
                  </p>
                </div>
                <Button variant="outline" onClick={downloadCertificate} disabled={downloadingCertificate}>
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  {downloadingCertificate ? 'Preparing…' : 'Download certificate'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Risk by Module */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Card>
            <CardHeader>
              <CardTitle level={2} className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5" />
                Risk by Module
              </CardTitle>
              <CardDescription>
                Which areas represent the highest risk?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={results.modules}
                  margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="title"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis label={{ value: 'Risk Score', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                    }}
                  />
                  <Bar
                    dataKey="score"
                    fill="hsl(var(--primary))"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>

              {/* High-risk modules */}
              <div className="mt-6 space-y-2">
                <h3 className="font-semibold text-sm">Areas requiring attention:</h3>
                <div className="space-y-2">
                  {results.modules
                    .filter(m => m.score >= 60)
                    .map(module => (
                      <div
                        key={module.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <span className="text-sm font-medium">{module.title}</span>
                        </div>
                        <Badge variant="secondary">{module.score}</Badge>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Key Risk Factors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle level={2} className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                Key Risk Factors
              </CardTitle>
              <CardDescription>
                The most significant fraud risks identified
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topRisks.length === 0 && (
                  <p className="text-sm text-muted-foreground">No specific risk factors were identified from your answers.</p>
                )}
                {topRisks.map((factor, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        factor.impact === 'high'
                          ? 'bg-destructive/20'
                          : factor.impact === 'medium'
                          ? 'bg-warning/20'
                          : 'bg-info/20'
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{factor.risk}</p>
                      <p className="text-xs text-muted-foreground">{factor.moduleTitle}</p>
                      <Badge
                        variant="outline"
                        className={`mt-1 capitalize ${ 
                          factor.impact === 'high'
                            ? 'border-destructive text-destructive'
                            : factor.impact === 'medium'
                            ? 'border-warning text-amber-800'
                            : 'border-info text-info'
                        }`}
                      >
                        {factor.severity} severity
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
