import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, ListPlus, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { NINETY_DAY_ROADMAP, SELF_ASSESSMENT_CHECKLIST, type ChecklistGroup } from '@/data/selfAssessment';
import type { ActionItem, ActionPlan } from '@/types/workshop';

const logger = createLogger('ResourceChecklist');

type Kind = 'checklist' | 'roadmap';

const CONTENT: Record<Kind, {
  title: string; intro: string; groups: ChecklistGroup[]; pdf: string; gapLabel: string; addLabel: string;
}> = {
  checklist: {
    title: 'Fraud Risk Self-Assessment Checklist',
    intro: 'A quick check of your organisation’s fraud prevention against the six principles in the Home Office guidance on the failure to prevent fraud offence (Economic Crime and Corporate Transparency Act 2023). Tick each statement that is true and evidenced today. Every unticked item is a gap to put in your action plan.',
    groups: SELF_ASSESSMENT_CHECKLIST,
    pdf: '/resources/fraud-risk-self-assessment-checklist.pdf',
    gapLabel: 'gap',
    addLabel: 'Add the unticked items to my action plan',
  },
  roadmap: {
    title: '90-Day Implementation Roadmap',
    intro: 'A practical plan for putting reasonable fraud prevention procedures in place over three months, in line with the six principles of the Home Office guidance and GovS 013. Tick each action when it is done, and adjust the timing to the size and risk of your organisation.',
    groups: NINETY_DAY_ROADMAP,
    pdf: '/resources/90-day-implementation-roadmap.pdf',
    gapLabel: 'action left',
    addLabel: 'Add the remaining actions to my action plan',
  },
};

interface Saved { ticked: string[]; organisation: string; completedBy: string; date: string }

const storageKey = (kind: Kind, userId: string) => `fra:${kind}:${userId}`;

function load(kind: Kind, userId: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(kind, userId));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

/** The self-assessment checklist and the 90-day roadmap, filled in on the web instead of on paper. */
export default function ResourceChecklist({ kind }: { kind: Kind }) {
  const content = CONTENT[kind];
  const { user, profile } = useAuth();
  const { entitlements } = useEntitlements();
  const userId = user?.id ?? 'anonymous';
  const saved = useMemo(() => load(kind, userId), [kind, userId]);

  const [ticked, setTicked] = useState<Set<string>>(() => new Set(saved?.ticked ?? []));
  const [organisation, setOrganisation] = useState(saved?.organisation ?? profile?.organization_name ?? '');
  const [completedBy, setCompletedBy] = useState(saved?.completedBy ?? profile?.full_name ?? user?.name ?? '');
  const [date, setDate] = useState(saved?.date ?? new Date().toISOString().slice(0, 10));
  const [adding, setAdding] = useState(false);

  // Answers are kept as you go, so leaving the page loses nothing
  useEffect(() => {
    const value: Saved = { ticked: [...ticked], organisation, completedBy, date };
    try { localStorage.setItem(storageKey(kind, userId), JSON.stringify(value)); } catch { /* storage full or blocked */ }
  }, [kind, userId, ticked, organisation, completedBy, date]);

  const allItems = content.groups.flatMap((g) => g.items);
  const done = allItems.filter((i) => ticked.has(i.id)).length;
  const gaps = allItems.filter((i) => !ticked.has(i.id));
  const canUseActionPlan = !!entitlements?.features.training;

  const toggle = (id: string, on: boolean) => setTicked((prev) => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const addToActionPlan = async () => {
    setAdding(true);
    try {
      const plan = await api.get<ActionPlan | null>('/api/v1/workshop/action-plans');
      const existing = plan?.action_items ?? [];
      const known = new Set(existing.map((i) => i.id));
      const groupOf = (id: string) => content.groups.find((g) => g.items.some((i) => i.id === id))!;
      const added: ActionItem[] = gaps
        .map((i) => ({ item: i, itemId: `${kind}-${i.id}` }))
        .filter(({ itemId }) => !known.has(itemId))
        .map(({ item, itemId }) => ({
          id: itemId,
          title: item.text,
          description: `${content.title}: ${groupOf(item.id).title}${item.owner ? ` · Suggested owner: ${item.owner}` : ''}`,
          priority: kind === 'checklist' ? 'high' : 'medium',
          // The action plan groups items as Immediate, 30 Days or 90 Days
          timeframe: kind === 'roadmap' && groupOf(item.id).id !== 'days-1-30' ? '90 Days' : '30 Days',
          completed: false,
        }));
      if (added.length === 0) {
        toast.success('Your action plan already has these items');
        return;
      }
      if (plan) {
        await api.patch(`/api/v1/workshop/action-plans/${plan.id}`, { actionItems: [...existing, ...added] });
      } else {
        await api.post('/api/v1/workshop/action-plans', { actionItems: added });
      }
      toast.success(`${added.length} item${added.length === 1 ? '' : 's'} added to your action plan`);
    } catch (err: unknown) {
      logger.error('Failed to add items to the action plan', err);
      toast.error('Could not update your action plan. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Layout>
      <div className="container max-w-3xl py-8 lg:py-12">
        <Button variant="ghost" className="mb-6 print:hidden" asChild>
          <Link to="/resources"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />All resources</Link>
        </Button>

        <h1 className="text-3xl font-bold tracking-tight mb-2">{content.title}</h1>
        <p className="text-muted-foreground mb-6">{content.intro}</p>

        <Card className="mb-6">
          <CardContent className="pt-6 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${kind}-organisation`}>Organisation</Label>
              <Input id={`${kind}-organisation`} value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${kind}-completed-by`}>Completed by</Label>
              <Input id={`${kind}-completed-by`} value={completedBy} onChange={(e) => setCompletedBy(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${kind}-date`}>Date</Label>
              <Input id={`${kind}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="mb-6 space-y-2" aria-live="polite">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{done} of {allItems.length} ticked</span>
            <span className="text-muted-foreground">{gaps.length} {content.gapLabel}{gaps.length === 1 ? '' : 's'}</span>
          </div>
          <Progress value={(done / allItems.length) * 100} className="h-2" aria-label={`${done} of ${allItems.length} ticked`} />
        </div>

        <div className="space-y-4">
          {content.groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <CardTitle level={2} className="text-lg">{group.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <Checkbox
                      id={`${kind}-${item.id}`}
                      checked={ticked.has(item.id)}
                      onCheckedChange={(v) => toggle(item.id, v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor={`${kind}-${item.id}`} className="font-normal leading-snug cursor-pointer">
                      {item.text}
                      {item.owner && <span className="block text-xs text-muted-foreground mt-0.5">Suggested owner: {item.owner}</span>}
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          {canUseActionPlan && gaps.length > 0 && (
            <Button onClick={addToActionPlan} disabled={adding}>
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <ListPlus className="mr-2 h-4 w-4" aria-hidden="true" />}
              {content.addLabel}
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" aria-hidden="true" />Print
          </Button>
          <Button variant="outline" asChild>
            <a href={content.pdf} download><Download className="mr-2 h-4 w-4" aria-hidden="true" />Blank PDF</a>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Your ticks are kept on this device. This is a self-assessment aid: it supports, but does not replace, legal advice
          on the Economic Crime and Corporate Transparency Act 2023 or a formal GovS 013 assurance review.
        </p>
      </div>
    </Layout>
  );
}
