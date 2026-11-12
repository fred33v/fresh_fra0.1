import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { ActionItem, ActionPlan } from '@/types/workshop';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';

const TIMEFRAME_ORDER = ['Immediate', '30 Days', '90 Days'];
const rank = (t: string) => {
  const i = TIMEFRAME_ORDER.indexOf(t);
  return i < 0 ? TIMEFRAME_ORDER.length : i;
};

/**
 * The next few things on the person's own action plan, ticked off from the dashboard.
 * Staff are told that their employer sees how many they have done.
 */
export function NextActions({ showEmployerNote = false }: { showEmployerNote?: boolean }) {
  const [plan, setPlan] = useState<ActionPlan | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    api.get<ActionPlan | null>('/api/v1/workshop/action-plans')
      .then((p) => {
        if (active) setPlan(p ?? null);
      })
      .catch(() => {
        if (active) setPlan(null);
      });

    return () => {
      active = false;
    };
  }, []);

  if (plan === undefined) return null;

  const items: ActionItem[] = Array.isArray(plan?.action_items) ? plan.action_items : [];
  const done = items.filter((i) => i.completed).length;
  const next = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.completed)
    .sort((a, b) => rank(a.item.timeframe) - rank(b.item.timeframe) || a.index - b.index)
    .slice(0, 3)
    .map(({ item }) => item);

  const tick = async (id: string) => {
    if (!plan) return;
    const previous = plan.action_items;
    const updated = previous.map((i) => (i.id === id ? { ...i, completed: true } : i));
    setPlan({ ...plan, action_items: updated });
    try {
      await api.patch(`/api/v1/workshop/action-plans/${plan.id}`, { actionItems: updated });
      toast.success('Action done');
    } catch {
      setPlan({ ...plan, action_items: previous });
      toast.error('Could not save. Please try again.');
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-accent" aria-hidden="true" />
          My next actions
        </CardTitle>
        {items.length > 0 && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Progress value={(done / items.length) * 100} className="h-2 w-40" aria-label={`${done} of ${items.length} actions done`} />
            <span>{done} of {items.length} done</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!plan || items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Your action plan lists what to put in place after the training.</p>
        ) : next.length === 0 ? (
          <p className="text-sm">Every action on your plan is done. Well done.</p>
        ) : (
          <ul className="space-y-2">
            {next.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <Checkbox id={`next-${item.id}`} className="mt-0.5" onCheckedChange={() => tick(item.id)} />
                <label htmlFor={`next-${item.id}`} className="text-sm leading-snug flex-1 cursor-pointer">{item.title}</label>
                <Badge variant="outline" className="shrink-0">{item.timeframe}</Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {showEmployerNote
            ? <p className="text-xs text-muted-foreground">Your employer sees your training progress, your certificate and how many actions you have done, not your notes.</p>
            : <span />}
          <Button variant="outline" size="sm" asChild>
            <Link to="/action-plan">{plan && items.length ? 'See my whole plan' : 'Open my action plan'}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
