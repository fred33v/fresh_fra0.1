import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useWorkshopProgress } from '@/hooks/useWorkshopProgress';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
const logger = createLogger('ActionPlan');
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { actionPlanTemplates } from '@/data/workshopContent';
import { ActionPlan as ActionPlanType, ActionItem } from '@/types/workshop';
import {
  Target,
  ArrowLeft,
  Save,
  Loader2,
  Clock,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ActionPlan() {
  const { user, profile } = useAuth();
  useWorkshopProgress();
  const navigate = useNavigate();
  const [actionPlan, setActionPlan] = useState<ActionPlanType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [customCommitments, setCustomCommitments] = useState('');
  const [fetchError, setFetchError] = useState(false);

  const fetchActionPlan = useCallback(async () => {
    if (!user) return;
    setFetchError(false);

    try {
      const plans = await api.get<ActionPlanType[]>('/api/v1/workshop/action-plans');
      const data = plans.length > 0 ? plans[0] : null;

      if (data) {
        setActionPlan({
          ...data,
          action_items: (data.action_items as unknown as ActionItem[]) || generateDefaultItems(),
        });
        setCustomCommitments(data.commitments?.join('\n') || '');
      } else {
        // Create default action plan
        const defaultItems = generateDefaultItems();
        const newPlan = await api.post<ActionPlanType>('/api/v1/workshop/action-plans', {
          actionItems: defaultItems,
          commitments: [],
        });

        setActionPlan({
          ...newPlan,
          action_items: defaultItems,
        });
      }
    } catch (err: unknown) {
      logger.error('Error fetching action plan', err);
      toast.error('Failed to load action plan');
      setFetchError(true);
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchActionPlan();
    }
  }, [user, fetchActionPlan]);

  const generateDefaultItems = (): ActionItem[] => {
    return [
      ...actionPlanTemplates.immediate.map((item, i) => ({
        id: `immediate-${i}`,
        title: item,
        description: '',
        priority: 'high' as const,
        timeframe: 'Immediate',
        completed: false,
      })),
      ...actionPlanTemplates.thirtyDays.map((item, i) => ({
        id: `thirty-${i}`,
        title: item,
        description: '',
        priority: 'medium' as const,
        timeframe: '30 Days',
        completed: false,
      })),
      ...actionPlanTemplates.ninetyDays.map((item, i) => ({
        id: `ninety-${i}`,
        title: item,
        description: '',
        priority: 'low' as const,
        timeframe: '90 Days',
        completed: false,
      })),
    ];
  };

  const toggleItemComplete = async (itemId: string) => {
    if (!actionPlan) return;

    const previousItems = actionPlan.action_items;
    const updatedItems = previousItems.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    setActionPlan(prev => prev ? { ...prev, action_items: updatedItems } : null);

    try {
      await api.patch(`/api/v1/workshop/action-plans/${actionPlan.id}`, {
        actionItems: updatedItems,
      });
    } catch (err: unknown) {
      logger.error('Error updating action plan', err);
      // Revert optimistic update on failure
      setActionPlan(prev => prev ? { ...prev, action_items: previousItems } : null);
      toast.error('Failed to update action item');
    }
  };

  const saveCommitments = async () => {
    if (!actionPlan) return;

    setIsSaving(true);
    const commitments = customCommitments.split('\n').filter(c => c.trim());

    try {
      await api.patch(`/api/v1/workshop/action-plans/${actionPlan.id}`, {
        commitments,
      });
      toast.success('Commitments saved!');
    } catch {
      toast.error('Failed to save commitments');
    }

    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Loading action plan">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        </div>
      </Layout>
    );
  }

  if (!user || !profile) return null;

  if (fetchError && !actionPlan) {
    return (
      <Layout>
        <div className="container py-8 lg:py-12">
          <Card className="max-w-md mx-auto text-center" role="alert">
            <CardContent className="pt-8 pb-6">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" aria-hidden="true" />
              <h2 className="text-lg font-semibold mb-2">Failed to load action plan</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Please check your connection and try again.
              </p>
              <Button onClick={() => { setIsLoading(true); fetchActionPlan(); }}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!actionPlan || actionPlan.action_items.length === 0) {
    return (
      <Layout>
        <div className="container py-8 lg:py-12">
          <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="pt-8 pb-6">
              <Target className="h-10 w-10 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
              <h2 className="text-lg font-semibold mb-2">No action items yet</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Complete the workshop to generate your personalised action plan.
              </p>
              <Button onClick={() => navigate('/workshop')}>Go to Workshop</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const groupedItems = {
    immediate: actionPlan.action_items.filter(i => i.timeframe === 'Immediate'),
    thirtyDays: actionPlan.action_items.filter(i => i.timeframe === '30 Days'),
    ninetyDays: actionPlan.action_items.filter(i => i.timeframe === '90 Days'),
  };

  const totalItems = actionPlan.action_items.length;
  const completedItems = actionPlan.action_items.filter(i => i.completed).length;
  const progressPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <Layout>
      <div className="container py-8 lg:py-12">
        <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Your Action Plan</h1>
              <p className="text-lg text-muted-foreground">
                Track your progress on implementing fraud prevention measures
              </p>
            </div>

            <Card className="lg:w-64">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1" aria-hidden="true">{completedItems}/{totalItems}</div>
                  <div className="text-sm text-muted-foreground mb-3" id="progress-label">Actions Completed</div>
                  <div
                    className="w-full bg-muted rounded-full h-2"
                    role="progressbar"
                    aria-valuenow={completedItems}
                    aria-valuemin={0}
                    aria-valuemax={totalItems}
                    aria-labelledby="progress-label"
                  >
                    <div
                      className="bg-success h-2 rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Immediate Actions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-destructive" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Immediate</CardTitle>
                    <CardDescription>Within 7 days</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 list-none p-0 m-0" aria-label="Immediate action items">
                  {groupedItems.immediate.map(item => (
                    <li
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        item.completed ? 'bg-success/5 border-success/30' : 'hover:bg-muted'
                      }`}
                    >
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => toggleItemComplete(item.id)}
                        className="mt-0.5"
                        aria-label={`${item.title} (${item.completed ? 'completed' : 'not completed'})`}
                      />
                      <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
                        {item.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* 30-Day Actions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-warning" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">30 Days</CardTitle>
                    <CardDescription>First month</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 list-none p-0 m-0" aria-label="30-day action items">
                  {groupedItems.thirtyDays.map(item => (
                    <li
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        item.completed ? 'bg-success/5 border-success/30' : 'hover:bg-muted'
                      }`}
                    >
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => toggleItemComplete(item.id)}
                        className="mt-0.5"
                        aria-label={`${item.title} (${item.completed ? 'completed' : 'not completed'})`}
                      />
                      <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
                        {item.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* 90-Day Actions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                    <Target className="h-4 w-4 text-success" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">90 Days</CardTitle>
                    <CardDescription>First quarter</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 list-none p-0 m-0" aria-label="90-day action items">
                  {groupedItems.ninetyDays.map(item => (
                    <li
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        item.completed ? 'bg-success/5 border-success/30' : 'hover:bg-muted'
                      }`}
                    >
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => toggleItemComplete(item.id)}
                        className="mt-0.5"
                        aria-label={`${item.title} (${item.completed ? 'completed' : 'not completed'})`}
                      />
                      <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
                        {item.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Personal Commitments */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Your Personal Commitments</CardTitle>
              <CardDescription>
                Add your own commitments based on what you've learned in the workshop
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter your commitments (one per line)..."
                value={customCommitments}
                onChange={(e) => setCustomCommitments(e.target.value)}
                rows={4}
                className="mb-4"
                aria-label="Your personal commitments, one per line"
              />
              <Button onClick={saveCommitments} disabled={isSaving} aria-busy={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Save Commitments
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}