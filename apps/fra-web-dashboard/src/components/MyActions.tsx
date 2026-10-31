import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { riskAreaLabel } from '@/lib/risk-scoring';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, ClipboardList, Copy, Loader2, Megaphone } from 'lucide-react';

export interface MyAction {
  id: string;
  title: string;
  riskArea: string;
  description?: string;
  priority: string;
  actionPlan?: string;
  dueDate?: string;
  status: 'open' | 'in_progress' | 'mitigated' | 'accepted' | 'closed';
  ownerNote?: string;
  ownerUpdatedAt?: string;
  reviewPending: boolean;
}

interface MyActionsData {
  risks: MyAction[];
  speakUpToken: string | null;
}

const STATUS_LABEL: Record<MyAction['status'], string> = {
  open: 'To do',
  in_progress: 'In progress',
  mitigated: 'Done and confirmed',
  accepted: 'Accepted',
  closed: 'Closed',
};

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Enterprise: the risk-register actions the employer gave to this person, and the
 * organisation's confidential reporting link. The employee says where they are and
 * marks an action done; the employer confirms it from the risk register.
 */
export function MyActions({ onlyIfAssigned = false }: { onlyIfAssigned?: boolean }) {
  const [data, setData] = useState<MyActionsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get<MyActionsData>('/api/v1/my-actions')
      .then((d) => { setData(d); setFailed(false); })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const save = async (id: string, status: 'in_progress' | 'done', withNote: boolean) => {
    setSaving(true);
    try {
      await api.post(`/api/v1/my-actions/${id}/progress`, withNote ? { status, note } : { status });
      toast.success(status === 'done' ? 'Marked as done. Your employer will confirm it.' : 'Update saved');
      setEditing(null);
      setNote('');
      load();
    } catch {
      toast.error('Could not save your update. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (failed) return null;
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your actions…
      </div>
    );
  }

  // The people who run the account already have the register and the reporting settings
  if (onlyIfAssigned && data.risks.length === 0) return null;

  const speakUpUrl = data.speakUpToken ? `${window.location.origin}/speak-up/${data.speakUpToken}` : null;

  return (
    <div className="grid gap-6 lg:grid-cols-3 mb-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
            My actions
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Fraud risks your organisation has asked you to manage. Mark an action done when it is in place; the person who runs the account confirms it.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.risks.length === 0 && (
            <p className="text-sm text-muted-foreground">No actions are assigned to you at the moment.</p>
          )}
          {data.risks.map((r) => {
            const overdue = !!r.dueDate && r.dueDate < today() && r.status !== 'mitigated' && r.status !== 'accepted';
            const closed = r.status === 'accepted' || r.status === 'closed';
            return (
              <div key={r.id} className="rounded-lg border p-4" data-testid="my-action">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-sm text-muted-foreground">{riskAreaLabel(r.riskArea)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.reviewPending
                      ? <Badge variant="secondary">Waiting for confirmation</Badge>
                      : <Badge variant={r.status === 'mitigated' ? 'default' : 'outline'}>{STATUS_LABEL[r.status]}</Badge>}
                    {overdue && <Badge variant="destructive">Overdue</Badge>}
                  </div>
                </div>
                {r.actionPlan && <p className="mt-3 text-sm"><span className="font-medium">What to do: </span>{r.actionPlan}</p>}
                {r.dueDate && <p className="mt-1 text-sm text-muted-foreground">Due {formatDate(r.dueDate)}</p>}
                {r.ownerNote && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your last update{r.ownerUpdatedAt ? ` (${formatDate(r.ownerUpdatedAt)})` : ''}: {r.ownerNote}
                  </p>
                )}

                {editing === r.id ? (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor={`note-${r.id}`}>What has been done? (optional)</Label>
                    <Textarea id={`note-${r.id}`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)}
                      placeholder="For example: call-back check on every bank detail change since 1 November" />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={saving} onClick={() => save(r.id, 'done', true)}>
                        <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden="true" /> Mark as done
                      </Button>
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => save(r.id, 'in_progress', true)}>
                        Save as in progress
                      </Button>
                      <Button size="sm" variant="ghost" disabled={saving} onClick={() => { setEditing(null); setNote(''); }}>Cancel</Button>
                    </div>
                  </div>
                ) : !closed && !r.reviewPending && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === 'open' && (
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => save(r.id, 'in_progress', false)}>I have started</Button>
                    )}
                    <Button size="sm" onClick={() => { setEditing(r.id); setNote(r.ownerNote ?? ''); }}>Give an update</Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-primary" aria-hidden="true" />
            Report a concern
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {speakUpUrl ? (
            <>
              <p className="text-muted-foreground">
                Seen something that worries you? Report it confidentially. You can stay anonymous and follow up with the reference you are given.
              </p>
              <Button asChild className="w-full"><a href={speakUpUrl}>Report a concern</a></Button>
              <Button variant="outline" className="w-full" onClick={() => { void navigator.clipboard?.writeText(speakUpUrl); toast.success('Link copied'); }}>
                <Copy className="mr-1 h-4 w-4" aria-hidden="true" /> Copy the link
              </Button>
              <Button variant="ghost" asChild className="w-full"><a href="/speak-up/status">Follow up on a report</a></Button>
            </>
          ) : (
            <p className="text-muted-foreground">
              Your organisation has not opened its confidential reporting channel yet. Speak to the person who runs your organisation&apos;s account.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
