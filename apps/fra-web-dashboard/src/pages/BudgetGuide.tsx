/**
 * Budget Guide Page
 *
 * Guides employers through creating a fraud prevention budget plan
 * based on their assessed fraud risks.
 *
 * Flow:
 * 1. View recommended budget based on assessment
 * 2. Set risk appetite level
 * 3. Add mitigation strategies with costs
 * 4. See allocation vs. recommended
 * 5. Generate implementation plan
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartFigure } from '@/components/ChartFigure';
import { AlertCircle, TrendingUp, CheckCircle2, Plus, Edit2, Trash2 } from 'lucide-react';
import { useBudgetGuide } from '@/hooks/useBudgetGuide';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createLogger } from '@/lib/logger';
import type { AssessmentResults } from '@/types/assessment';

const logger = createLogger('BudgetGuidePage');

interface FormData {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  category: 'prevention' | 'detection' | 'response' | 'culture';
  description: string;
  budget: number;
  timeline: '1-3 months' | '3-6 months' | '6-12 months' | '12+ months';
  status: 'planned' | 'in_progress' | 'completed';
}

const CATEGORY_COLORS: Record<string, string> = {
  prevention: '#3B82F6', // Blue
  detection: '#8B5CF6', // Purple
  response: '#EC4899', // Pink
  culture: '#10B981', // Green
};

// Risk levels shared by the mitigation form.
const RISK_LEVELS = [
  { value: 'low', label: 'Low', color: '#10B981' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#EF4444' },
  { value: 'critical', label: 'Critical', color: '#7C2D12' },
];

type Slice = { name: string; value: number };

/** Text alternative for an allocation pie chart: lists every share, largest first. */
function allocationSummary(title: string, data: Slice[]): string {
  const shares = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (shares.length === 0) return `Pie chart: ${title}. Nothing allocated yet.`;
  return `Pie chart: ${title}. ` + shares.map((d) => `${d.name} ${d.value}%`).join(', ') + '.';
}

/** Text alternative for the comparison chart: names the categories furthest from the recommendation. */
function comparisonSummary(recommended: Slice[], actual: Slice[]): string {
  const gaps = recommended
    .map((d, i) => ({ name: d.name, gap: Number(((actual[i]?.value ?? 0) - d.value).toFixed(1)) }))
    .filter((g) => g.gap !== 0)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  if (gaps.length === 0)
    return 'Bar chart comparing recommended and current allocation. They match in every category.';
  const g = gaps[0];
  return (
    'Bar chart comparing recommended and current allocation by category. ' +
    `The biggest difference is ${g.name}: ${Math.abs(g.gap)} points ${g.gap > 0 ? 'above' : 'below'} the recommendation.`
  );
}

export function BudgetGuidePage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { user } = useAuth();
  return <BudgetGuideContent key={`${user?.userId}:${assessmentId}`} assessmentId={assessmentId} />;
}

function BudgetGuideContent({ assessmentId }: { assessmentId?: string }) {
  const confirm = useConfirm();

  // The score of the assessment in the link, as its results page shows it
  const [riskScore, setRiskScore] = useState<number | null>(null);

  const {
    progress,
    isLoading,
    isSaving,
    riskAppetite,
    mitigations,
    error,
    fetchProgress,
    setRiskAppetite,
    addMitigation,
    updateMitigation,
    removeMitigation,
    completePlan,
    downloadReport,
    calculateRecommendedAllocation,
    calculateActualAllocation,
    getProgressPercentage,
  } = useBudgetGuide(assessmentId);

  const [showMitigationDialog, setShowMitigationDialog] = useState(false);
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [justification, setJustification] = useState('');
  const [scoreError, setScoreError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    riskLevel: 'medium',
    category: 'prevention',
    description: '',
    budget: 0,
    timeline: '3-6 months',
    status: 'planned',
  });

  const savedAppetiteLevel = riskAppetite?.level,
    savedAppetiteReason = riskAppetite?.justification,
    savedAppetiteTime = riskAppetite?.updated_at;
  useEffect(() => {
    if (savedAppetiteLevel) {
      setRiskLevel(savedAppetiteLevel);
      setJustification(savedAppetiteReason ?? '');
    }
  }, [savedAppetiteLevel, savedAppetiteReason, savedAppetiteTime]);
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  useEffect(() => {
    if (!assessmentId) return;
    api
      .get<AssessmentResults>(`/api/v1/assessments/${assessmentId}/results`)
      .then((results) => setRiskScore(results.overallScore))
      .catch((err) => {
        setScoreError(true);
        logger.error('Error loading assessment results', err);
      });
  }, [assessmentId]);

  const handleAddMitigation = async () => {
    if (!formData.description.trim() || !Number.isFinite(formData.budget) || formData.budget < 0)
      return;

    try {
      const input = {
        risk_level: formData.riskLevel,
        category: formData.category,
        description: formData.description,
        budget: formData.budget,
        timeline: formData.timeline,
        status: formData.status,
      };
      if (editingId) await updateMitigation(editingId, input);
      else await addMitigation(input);

      setFormData({
        riskLevel: 'medium',
        category: 'prevention',
        description: '',
        budget: 0,
        timeline: '3-6 months',
        status: 'planned',
      });
      setEditingId(null);
      setShowMitigationDialog(false);
    } catch (err) {
      logger.error('Error adding mitigation', err);
    }
  };

  const handleSetRiskAppetite = async () => {
    try {
      await setRiskAppetite({ level: riskLevel, justification });
    } catch (err) {
      logger.error('Error setting risk appetite', err);
    }
  };
  const handleRemove = async (id: string) => {
    if (
      !(await confirm({
        title: 'Remove this strategy?',
        description:
          'The strategy will be removed from the current plan. Its saved history is retained.',
        confirmLabel: 'Remove strategy',
      }))
    )
      return;
    try {
      await removeMitigation(id);
    } catch (err) {
      logger.error('Error removing strategy', err);
    }
  };

  const recommended = riskScore === null ? {} : calculateRecommendedAllocation(riskScore);
  const actual = calculateActualAllocation();
  const progress_pct = getProgressPercentage();

  const recommendedData = Object.entries(recommended).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: Number((value * 100).toFixed(1)),
  }));

  const actualData = Object.entries(actual).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: Number(value.toFixed(1)),
  }));

  const totalBudget = mitigations.reduce((sum, m) => sum + (m.budget || 0), 0);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-4xl font-bold text-gray-900">Budget Guide</h1>
          <p className="text-lg text-gray-600">
            Create a fraud prevention budget based on your risk assessment
          </p>
        </motion.div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}{' '}
              <Button variant="link" onClick={fetchProgress} disabled={isSaving}>
                Reload saved plan
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading && <p role="status">Loading saved budget plan…</p>}
        {scoreError && (
          <Alert variant="destructive">
            <AlertDescription>
              Assessment results could not be loaded. Refresh the page to retry; recommendations are
              unavailable.
            </AlertDescription>
          </Alert>
        )}
        {/* Progress Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle level={2} className="text-sm font-medium text-gray-600">
                Risk Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-600">{riskScore ?? '—'}</div>
              <p className="text-xs text-gray-500 mt-1">From assessment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle level={2} className="text-sm font-medium text-gray-600">
                Risk Appetite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {riskAppetite?.level?.toUpperCase() || '—'}
              </div>
              <div className="space-y-2 mt-3">
                <label htmlFor="risk-appetite-level">Appetite level</label>
                <select
                  id="risk-appetite-level"
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value as typeof riskLevel)}
                  className="w-full border rounded p-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <label htmlFor="risk-appetite-reason">Justification</label>
                <textarea
                  id="risk-appetite-reason"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  maxLength={2000}
                  className="w-full border rounded p-2"
                />
                <Button
                  onClick={handleSetRiskAppetite}
                  disabled={isSaving || isLoading || !progress || !justification.trim()}
                >
                  Save appetite
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle level={2} className="text-sm font-medium text-gray-600">
                Total Budget
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
                  totalBudget
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{mitigations.length} strategies</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle level={2} className="text-sm font-medium text-gray-600">
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{Math.round(progress_pct)}%</div>
              <p className="text-xs text-gray-500 mt-1">Completion</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs defaultValue="allocation" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="allocation">Budget Allocation</TabsTrigger>
              <TabsTrigger value="strategies">Mitigation Strategies</TabsTrigger>
              <TabsTrigger value="timeline">Implementation Plan</TabsTrigger>
            </TabsList>

            {/* Budget Allocation Tab */}
            <TabsContent value="allocation" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recommended */}
                <Card>
                  <CardHeader>
                    <CardTitle level={2}>Recommended Allocation</CardTitle>
                    <CardDescription>Based on your risk score of {riskScore}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartFigure
                      summary={allocationSummary('Recommended allocation', recommendedData)}
                      caption="Recommended budget allocation by category"
                      columns={['Category', 'Share of budget (%)']}
                      rows={recommendedData.map((d) => [d.name, d.value])}
                    >
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            rootTabIndex={-1}
                            data={recommendedData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value }) => `${name}: ${value}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {Object.keys(CATEGORY_COLORS).map((key) => (
                              <Cell key={key} fill={CATEGORY_COLORS[key]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartFigure>
                  </CardContent>
                </Card>

                {/* Actual */}
                <Card>
                  <CardHeader>
                    <CardTitle level={2}>Your Current Allocation</CardTitle>
                    <CardDescription>
                      Based on {mitigations.length} planned strategies
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartFigure
                      summary={allocationSummary('Your current allocation', actualData)}
                      caption="Your current budget allocation by category"
                      columns={['Category', 'Share of budget (%)']}
                      rows={actualData.map((d) => [d.name, d.value])}
                    >
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            rootTabIndex={-1}
                            data={actualData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value }) => `${name}: ${value}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {Object.keys(CATEGORY_COLORS).map((key) => (
                              <Cell key={key} fill={CATEGORY_COLORS[key]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartFigure>
                  </CardContent>
                </Card>
              </div>

              {/* Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle level={2}>Allocation Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartFigure
                    summary={comparisonSummary(recommendedData, actualData)}
                    caption="Recommended and current budget allocation by category"
                    columns={['Category', 'Recommended (%)', 'Current (%)']}
                    rows={recommendedData.map((d, i) => [
                      d.name,
                      d.value,
                      actualData[i]?.value ?? 0,
                    ])}
                  >
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        accessibilityLayer={false}
                        data={recommendedData.map((item, idx) => ({
                          ...item,
                          recommended: item.value,
                          actual: actualData[idx]?.value || 0,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="recommended" fill="#8B5CF6" />
                        <Bar dataKey="actual" fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartFigure>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Mitigation Strategies Tab */}
            <TabsContent value="strategies" className="space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setEditingId(null);
                    setFormData({
                      riskLevel: 'medium',
                      category: 'prevention',
                      description: '',
                      budget: 0,
                      timeline: '3-6 months',
                      status: 'planned',
                    });
                    setShowMitigationDialog(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Strategy
                </Button>
              </div>

              <div className="space-y-3">
                {mitigations.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-center text-gray-500">
                        No mitigation strategies yet. Add the first one to get started.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  mitigations.map((m, idx) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className="inline-block w-3 h-3 rounded-full"
                                  style={{ backgroundColor: CATEGORY_COLORS[m.category] }}
                                />
                                <span className="font-semibold text-gray-900">{m.description}</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Category</span>
                                  <p className="font-medium capitalize">{m.category}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Budget</span>
                                  <p className="font-medium">£{m.budget?.toLocaleString()}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Timeline</span>
                                  <p className="font-medium">{m.timeline}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Risk Level</span>
                                  <p className="font-medium capitalize">{m.risk_level}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingId(m.id);
                                  setFormData({
                                    riskLevel: m.risk_level as
                                      | 'low'
                                      | 'medium'
                                      | 'high'
                                      | 'critical',
                                    category: m.category as
                                      | 'prevention'
                                      | 'detection'
                                      | 'response'
                                      | 'culture',
                                    description: m.description,
                                    budget: m.budget || 0,
                                    timeline: m.timeline,
                                    status: m.status,
                                  });
                                  setShowMitigationDialog(true);
                                }}
                              >
                                <span className="sr-only">Edit strategy {m.description}</span>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                disabled={isSaving || isLoading}
                                onClick={() => {
                                  void handleRemove(m.id);
                                }}
                              >
                                <span className="sr-only">Remove strategy {m.description}</span>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Implementation Plan Tab */}
            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle level={2}>Implementation Roadmap</CardTitle>
                  <CardDescription>
                    Timeline for rolling out your fraud prevention measures
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {['1-3 months', '3-6 months', '6-12 months', '12+ months'].map((timeline) => (
                      <div key={timeline} className="border rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">{timeline}</h4>
                        <div className="space-y-2">
                          {mitigations
                            .filter((m) => m.timeline === timeline)
                            .map((m) => (
                              <div key={m.id} className="flex items-start gap-3 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="font-medium text-gray-900">{m.description}</p>
                                  <p className="text-gray-500">
                                    {m.category === 'prevention' && 'Fraud Prevention'}
                                    {m.category === 'detection' && 'Detection Control'}
                                    {m.category === 'response' && 'Response Procedure'}
                                    {m.category === 'culture' && 'Culture & Training'}
                                    {' • £'}
                                    {m.budget?.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          {mitigations.filter((m) => m.timeline === timeline).length === 0 && (
                            <p className="text-gray-400 text-sm italic">
                              No strategies planned for this period
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button
                className="w-full gap-2"
                size="lg"
                disabled={!progress || isLoading || isSaving}
                onClick={() => {
                  void downloadReport().catch(() => {});
                }}
              >
                <TrendingUp className="h-5 w-5" />
                Download Implementation Report
              </Button>
            </TabsContent>
          </Tabs>
        </motion.div>

        <Button
          disabled={
            isSaving ||
            isLoading ||
            !!progress?.completed_at ||
            !riskAppetite ||
            !mitigations.some((m) => m.budget > 0)
          }
          onClick={() => {
            void completePlan().catch(() => {});
          }}
        >
          {progress?.completed_at ? 'Budget plan completed' : 'Complete budget plan'}
        </Button>
        <p className="text-sm text-gray-600">
          Editing a completed plan returns it to draft for review.
        </p>
        {/* Mitigation Dialog */}
        <Dialog
          open={showMitigationDialog}
          onOpenChange={(open) => {
            if (!isSaving) setShowMitigationDialog(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit Mitigation Strategy' : 'Add Mitigation Strategy'}
              </DialogTitle>
              <DialogDescription>
                Specify a fraud prevention measure and its estimated budget
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {error && (
                <p role="alert" className="text-red-700">
                  {error}
                </p>
              )}
              <div>
                <label
                  htmlFor="mitigation-description"
                  className="text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <input
                  id="mitigation-description"
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Implement vendor approval process"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="mitigation-category"
                    className="text-sm font-medium text-gray-700"
                  >
                    Category
                  </label>
                  <select
                    id="mitigation-category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value as
                          | 'prevention'
                          | 'detection'
                          | 'response'
                          | 'culture',
                      })
                    }
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="prevention">Prevention</option>
                    <option value="detection">Detection</option>
                    <option value="response">Response</option>
                    <option value="culture">Culture</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="mitigation-risk" className="text-sm font-medium text-gray-700">
                    Risk Level
                  </label>
                  <select
                    id="mitigation-risk"
                    value={formData.riskLevel}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        riskLevel: e.target.value as 'low' | 'medium' | 'high' | 'critical',
                      })
                    }
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {RISK_LEVELS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mitigation-budget" className="text-sm font-medium text-gray-700">
                    Budget (£)
                  </label>
                  <input
                    id="mitigation-budget"
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.01"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                    placeholder="0"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label
                    htmlFor="mitigation-timeline"
                    className="text-sm font-medium text-gray-700"
                  >
                    Timeline
                  </label>
                  <select
                    id="mitigation-timeline"
                    value={formData.timeline}
                    onChange={(e) =>
                      setFormData({ ...formData, timeline: e.target.value as FormData['timeline'] })
                    }
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="1-3 months">1-3 months</option>
                    <option value="3-6 months">3-6 months</option>
                    <option value="6-12 months">6-12 months</option>
                    <option value="12+ months">12+ months</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="mitigation-status">Implementation status</label>
                <select
                  id="mitigation-status"
                  className="w-full border rounded p-2"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as FormData['status'] })
                  }
                >
                  <option value="planned">Planned</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => setShowMitigationDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddMitigation}
                  disabled={
                    isSaving ||
                    isLoading ||
                    !progress ||
                    !formData.description.trim() ||
                    !Number.isFinite(formData.budget) ||
                    formData.budget < 0
                  }
                >
                  {editingId ? 'Update' : 'Add'} Strategy
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

// App.tsx loads this page with React.lazy, which needs a default export
export default BudgetGuidePage;
