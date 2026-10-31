import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DEFAULT_APPROVAL_LIMITS, REPORT_CONTACTS, type ApprovalLimits, type ReportContactKey } from '@stopfra/shared/data';
import { api } from '@/lib/api';
import { BUDGET_HOLDER_STATUS_LABEL, type BudgetHolderProgress } from '@/lib/budget-holder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Loader2, Plus, Trash2 } from 'lucide-react';

interface Person extends BudgetHolderProgress { userId: string; name: string; email: string; role: string }
interface TeamData {
  summary: { required: number; completed: number; renewalDue: number; conflictsDeclared: number; totalParts: number };
  people: Person[];
}
type Contacts = Partial<Record<ReportContactKey, { name: string; contact: string }>>;


const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function Settings() {
  const [limits, setLimits] = useState<ApprovalLimits | null>(null);
  const [usingExample, setUsingExample] = useState(true);
  const [contacts, setContacts] = useState<Contacts>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ approvalLimits: ApprovalLimits | null; contacts: Contacts }>('/api/v1/budget-holder/settings')
      .then((s) => {
        setUsingExample(!s.approvalLimits);
        setLimits(s.approvalLimits ?? structuredClone(DEFAULT_APPROVAL_LIMITS));
        setContacts(s.contacts ?? {});
        setLoaded(true);
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not load the settings'));
  }, []);

  if (!loaded || !limits) return null;

  const setBand = (i: number, v: string) => setLimits({ ...limits, bands: limits.bands.map((b, j) => (j === i ? v : b)) });
  const setCell = (r: number, i: number, v: string) => setLimits({
    ...limits, rows: limits.rows.map((row, k) => (k === r ? { ...row, approvers: row.approvers.map((a, j) => (j === i ? v : a)) } : row)),
  });
  const setType = (r: number, v: string) => setLimits({ ...limits, rows: limits.rows.map((row, k) => (k === r ? { ...row, type: v } : row)) });
  const addRow = () => setLimits({ ...limits, rows: [...limits.rows, { type: '', approvers: limits.bands.map(() => '') }] });
  const removeRow = (r: number) => setLimits({ ...limits, rows: limits.rows.filter((_, k) => k !== r) });
  const setContact = (key: ReportContactKey, field: 'name' | 'contact', v: string) =>
    setContacts({ ...contacts, [key]: { name: contacts[key]?.name ?? '', contact: contacts[key]?.contact ?? '', [field]: v } });

  const save = async () => {
    setSaving(true);
    try {
      const rows = limits.rows.filter((r) => r.type.trim());
      await api.put('/api/v1/budget-holder/settings', { approvalLimits: { ...limits, rows }, contacts });
      setLimits({ ...limits, rows });
      setUsingExample(false);
      toast.success('Saved. Your budget holders now see these limits and contacts.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your limits and contacts</CardTitle>
        <CardDescription>
          Budget holders see your own approval limits and who to report to, not a generic example.
          {usingExample && ' The table below is an example until you save it.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-36">Type of spending</TableHead>
                {limits.bands.map((b, i) => (
                  <TableHead key={i} className="min-w-36">
                    <Input aria-label={`Band ${i + 1}`} value={b} onChange={(e) => setBand(i, e.target.value)} className="h-8" />
                  </TableHead>
                ))}
                <TableHead><span className="sr-only">Remove</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {limits.rows.map((row, r) => (
                <TableRow key={r}>
                  <TableCell><Input aria-label={`Type ${r + 1}`} value={row.type} onChange={(e) => setType(r, e.target.value)} className="h-8" /></TableCell>
                  {row.approvers.map((a, i) => (
                    <TableCell key={i}>
                      <Input aria-label={`${row.type || `Row ${r + 1}`}, ${limits.bands[i]}`} value={a} onChange={(e) => setCell(r, i, e.target.value)} className="h-8" />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeRow(r)} aria-label={`Remove ${row.type || 'row'}`} disabled={limits.rows.length <= 1}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" onClick={addRow}><Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Add a type of spending</Button>

        <div className="grid gap-4 md:grid-cols-2">
          {REPORT_CONTACTS.map((c) => (
            <fieldset key={c.key} className="space-y-1 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{c.role}</legend>
              <Label htmlFor={`${c.key}-name`} className="text-xs">Name or team</Label>
              <Input id={`${c.key}-name`} value={contacts[c.key]?.name ?? ''} onChange={(e) => setContact(c.key, 'name', e.target.value)} maxLength={120} />
              <Label htmlFor={`${c.key}-contact`} className="text-xs">Email or phone</Label>
              <Input id={`${c.key}-contact`} value={contacts[c.key]?.contact ?? ''} onChange={(e) => setContact(c.key, 'contact', e.target.value)} maxLength={200} />
            </fieldset>
          ))}
        </div>
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />} Save limits and contacts</Button>
      </CardContent>
    </Card>
  );
}

/** Enterprise: who must complete the budget holder programme, where they are, and their declarations. */
export function BudgetHolders() {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.get<TeamData>('/api/v1/budget-holder/team')
    .then(setData)
    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load your budget holders'));
  useEffect(() => { void load(); }, []);

  const setRequired = async (p: Person, required: boolean) => {
    try {
      await api.put(`/api/v1/budget-holder/team/${p.userId}`, { required });
      toast.success(required ? `${p.name} must now complete the programme` : `${p.name} no longer has to complete it`);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    }
  };

  const exportCsv = async () => {
    try {
      await api.download('/api/v1/budget-holder/team?format=csv', 'budget-holders.csv');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  if (error) return <p className="text-sm text-destructive" role="alert">{error}</p>;
  if (!data) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading your budget holders" /></div>;

  const { summary } = data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Budget holders', value: summary.required },
          { label: 'Completed this year', value: summary.completed },
          { label: 'Renewal due', value: summary.renewalDue },
          { label: 'Conflicts declared', value: summary.conflictsDeclared },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardDescription>{s.label}</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{s.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Budget holder programme</CardTitle>
            <CardDescription>Switch on everyone who approves spending. Anyone else can still take it. The export is part of your ECCTA evidence pack.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" aria-hidden="true" /> Export CSV</Button>
        </CardHeader>
        <CardContent>
          {data.people.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nobody has joined yet. Invite your team from the Key-passes tab.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Must complete</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Scenarios</TableHead>
                    <TableHead>Commitment</TableHead>
                    <TableHead>Conflict of interest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.people.map((p) => (
                    <TableRow key={p.userId}>
                      <TableCell>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </TableCell>
                      <TableCell>
                        <Switch checked={p.required} onCheckedChange={(v) => setRequired(p, v)} aria-label={`${p.name} must complete the programme`} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'completed' ? 'default' : p.status === 'renewal_due' ? 'destructive' : 'outline'}>{BUDGET_HOLDER_STATUS_LABEL[p.status]}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{p.requiredPartsDone}/{summary.totalParts} parts</p>
                      </TableCell>
                      <TableCell className="tabular-nums">{p.scenarioScore === null ? '—' : `${p.scenarioScore}%`}</TableCell>
                      <TableCell className="text-sm">{p.pledgedAt ? <>Signed {formatDate(p.pledgedAt)}<p className="text-xs text-muted-foreground">Renew by {formatDate(p.renewalDueAt)}</p></> : '—'}</TableCell>
                      <TableCell className="text-sm max-w-64">
                        {p.conflictDeclared === null ? '—' : p.conflictDeclared
                          ? <><Badge variant="destructive">Declared</Badge><p className="text-xs mt-1">{p.conflictDetails}</p></>
                          : 'None'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Settings />
    </div>
  );
}
