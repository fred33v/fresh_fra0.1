import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { riskAreaLabel } from '@/lib/risk-scoring';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ClipboardList, Loader2 } from 'lucide-react';

export interface RegisterSuggestion {
  title: string;
  riskArea: string;
  description: string;
  priority: 'high' | 'medium';
  raisedBy: number;
  assessedAt: string;
}

/**
 * Enterprise: what the fraud risk assessments found that is not in the register yet.
 * The employer picks which to add; they arrive as open risks to review and give an owner.
 */
export function ImportFromAssessment({ onImported }: { onImported: () => void }) {
  const [suggestions, setSuggestions] = useState<RegisterSuggestion[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = () => api.get<RegisterSuggestion[]>('/api/v1/risk-register/from-assessment')
    .then((s) => { setSuggestions(s); setPicked(new Set(s.map((x) => x.title))); })
    .catch(() => setSuggestions([]));
  useEffect(() => { void load(); }, []);

  if (!suggestions || suggestions.length === 0) return null;

  const toggle = (title: string) => setPicked((p) => { const n = new Set(p); if (n.has(title)) n.delete(title); else n.add(title); return n; });
  const importPicked = async () => {
    setSaving(true);
    try {
      const created = await api.post<unknown[]>('/api/v1/risk-register/from-assessment', { titles: [...picked] });
      toast.success(`${created.length} risk${created.length === 1 ? '' : 's'} added. Give each one an owner and an action.`);
      await load();
      onImported();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not add the risks');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-8 border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
          Import from your fraud risk assessment
        </CardTitle>
        <CardDescription>
          Your assessment found {suggestions.length} high or medium risk{suggestions.length === 1 ? '' : 's'} that {suggestions.length === 1 ? 'is' : 'are'} not in the register yet.
          Choose which to add. They arrive as open risks with no owner, for you to review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {suggestions.map((s) => (
            <li key={s.title} className="flex items-start gap-3">
              <Checkbox id={`imp-${s.title}`} checked={picked.has(s.title)} onCheckedChange={() => toggle(s.title)} className="mt-0.5" />
              <Label htmlFor={`imp-${s.title}`} className="font-normal leading-snug flex-1">
                <span className="font-medium">{s.title}</span>
                <span className="text-muted-foreground"> · {riskAreaLabel(s.riskArea)}{s.raisedBy > 1 ? ` · raised by ${s.raisedBy} people` : ''}</span>
              </Label>
              <Badge variant={s.priority === 'high' ? 'destructive' : 'outline'} className="shrink-0">{s.priority === 'high' ? 'High' : 'Medium'}</Badge>
            </li>
          ))}
        </ul>
        <Button onClick={importPicked} disabled={saving || picked.size === 0}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          Add {picked.size} to the register
        </Button>
      </CardContent>
    </Card>
  );
}
