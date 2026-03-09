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
} from 'lucide-react';
import { toast } from 'sonner';

interface RiskScore {
  overall: number;
  rating: 'low' | 'medium' | 'high' | 'critical';
  moduleScores: Array<{
    moduleId: string;
    moduleName: string;
    score: number;
    rating: string;
  }>;
  factors: Array<{
    factor: string;
    score: number;
    impact: 'high' | 'medium' | 'low';
  }>;
}

export default function AssessmentResults() {
  const { assessmentId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type RiskScoreResponse = any;

  useEffect(() => {
    const fetchResults = async () => {
      if (!assessmentId || !user) return;

      try {
        const data = await api.get<RiskScoreResponse>(
          `/api/v1/assessment/${assessmentId}/results`
        );
        setRiskScore(data);
      } catch (err: unknown) {
        const errorMsg = (err instanceof Error ? err.message : 'Failed to load results');
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
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

  if (error || !riskScore) {
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

  const getRiskColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-orange-500';
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
            Your fraud risk assessment has been analyzed
          </p>
        </motion.div>

        {/* Overall Risk Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8"
        >
          <Card className={`border-2 ${getRiskBgColor(riskScore.rating)}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
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
                        strokeDasharray={`${(riskScore.overall / 100) * 553} 553`}
                        className={`transition-all duration-1000 ${getRiskColor(riskScore.rating)}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className={`text-5xl font-bold ${getRiskColor(riskScore.rating)}`}>
                        {riskScore.overall}
                      </div>
                      <div className="text-sm text-muted-foreground">out of 100</div>
                    </div>
                  </div>
                </div>

                {/* Rating details */}
                <div className="flex flex-col justify-center space-y-4">
                  <div>
                    <Badge
                      className={`text-lg px-4 py-2 capitalize ${getRiskColor(riskScore.rating)} ${getRiskBgColor(riskScore.rating)}`}
                    >
                      {riskScore.rating} Risk
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">What this means:</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {riskScore.rating === 'low' &&
                        'Your organization demonstrates strong fraud prevention controls. Continue monitoring and regular staff training.'}
                      {riskScore.rating === 'medium' &&
                        'Your organization has some fraud prevention measures in place, but there are opportunities for improvement.'}
                      {riskScore.rating === 'high' &&
                        'Your organization has significant fraud risks that require immediate attention and remediation.'}
                      {riskScore.rating === 'critical' &&
                        'Your organization faces critical fraud risks. Urgent action is needed to strengthen controls.'}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => navigate('/action-plan')}
                      className="flex-1"
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Create Action Plan
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <Download className="mr-2 h-4 w-4" />
                      Download Report
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Risk by Module */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
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
                  data={riskScore.moduleScores}
                  margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="moduleName"
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
                <h4 className="font-semibold text-sm">Areas requiring attention:</h4>
                <div className="space-y-2">
                  {riskScore.moduleScores
                    .filter(m => m.score >= 60)
                    .map(module => (
                      <div
                        key={module.moduleId}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <span className="text-sm font-medium">{module.moduleName}</span>
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
              <CardTitle className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                Key Risk Factors
              </CardTitle>
              <CardDescription>
                The most significant fraud risks identified
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {riskScore.factors.map((factor, idx) => (
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
                      <span className="text-xs font-semibold">{factor.score}</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{factor.factor}</p>
                      <Badge
                        variant="outline"
                        className={`mt-1 capitalize ${ 
                          factor.impact === 'high'
                            ? 'border-destructive text-destructive'
                            : factor.impact === 'medium'
                            ? 'border-warning text-warning'
                            : 'border-info text-info'
                        }`}
                      >
                        {factor.impact} Impact
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
