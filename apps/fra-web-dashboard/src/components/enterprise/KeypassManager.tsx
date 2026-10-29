import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Download, KeyRound, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

const logger = createLogger('KeypassManager');

export interface Keypass {
  code: string;
  status: 'available' | 'used' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  usedByUserId?: string;
}

interface Quota { allowance: number; unlimited?: boolean; used: number; remaining: number | null }

const STATUS_LABEL: Record<Keypass['status'], string> = {
  available: 'Available', used: 'Redeemed', revoked: 'Revoked', expired: 'Expired',
};

const STATUS_STYLE: Record<Keypass['status'], string> = {
  available: 'bg-primary/10 text-primary border-primary/20',
  used: 'bg-success/10 text-success border-success/20',
  revoked: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
};

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** The page an employee opens to use a key-pass, with the code filled in. */
function joinLink(code: string): string {
  return `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
}

function downloadCodes(codes: string[], expiresAt: string) {
  const csv = ['Key-pass,Expires', ...codes.map((c) => `${c},${expiresAt.slice(0, 10)}`)].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `key-passes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface KeypassManagerProps {
  organisationId: string;
  /** Maps user ids to names so used key-passes show who redeemed them */
  userNames?: Record<string, string>;
}

export function KeypassManager({ organisationId, userNames = {} }: KeypassManagerProps) {
  const confirm = useConfirm();
  const [keypasses, setKeypasses] = useState<Keypass[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState('10');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [formError, setFormError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newCodes, setNewCodes] = useState<{ codes: string[]; expiresAt: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const [list, q] = await Promise.all([
        api.get<Keypass[]>(`/api/v1/keypasses/organisation/${organisationId}?pageSize=200`),
        api.get<Quota>(`/api/v1/keypasses/organisation/${organisationId}/quota`),
      ]);
      setKeypasses(list);
      setQuota(q);
    } catch (err: unknown) {
      logger.error('Failed to load key-passes', err);
      toast.error('Could not load key-passes');
    } finally {
      setIsLoading(false);
    }
  }, [organisationId]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => keypasses.reduce<Record<string, number>>((acc, k) => {
    acc[k.status] = (acc[k.status] ?? 0) + 1;
    return acc;
  }, {}), [keypasses]);

  const visible = statusFilter === 'all' ? keypasses : keypasses.filter((k) => k.status === statusFilter);

  const generate = async () => {
    const n = Number(quantity);
    const days = Number(expiresInDays);
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      setFormError('Enter a quantity between 1 and 500');
      return;
    }
    if (quota && quota.remaining !== null && n > quota.remaining) {
      setFormError(`Your package allows ${quota.remaining} more key-pass${quota.remaining === 1 ? '' : 'es'}`);
      return;
    }
    setIsGenerating(true);
    try {
      const result = await api.post<{ codes: string[]; expiresAt: string }>('/api/v1/keypasses/generate', { quantity: n, expiresInDays: days });
      setNewCodes(result);
      toast.success(`${result.codes.length} key-pass${result.codes.length === 1 ? '' : 'es'} created`);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create key-passes');
    } finally {
      setIsGenerating(false);
    }
  };

  const revoke = async (code: string) => {
    if (!(await confirm({ title: `Revoke key-pass ${code}?`, description: 'It will no longer let anyone join.', confirmLabel: 'Revoke', destructive: true }))) return;
    try {
      await api.post('/api/v1/keypasses/revoke', { code });
      toast.success('Key-pass revoked');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke key-pass');
    }
  };

  const copyText = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(success);
    } catch {
      toast.error('Copy failed — download the CSV instead');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Allowance', value: quota ? (quota.unlimited ? 'Unlimited' : quota.allowance) : '—' },
          { label: 'Available', value: counts.available ?? 0 },
          { label: 'Redeemed', value: counts.used ?? 0 },
          { label: 'Revoked or expired', value: (counts.revoked ?? 0) + (counts.expired ?? 0) },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardDescription>{s.label}</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{s.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5" aria-hidden="true" /> Issue key-passes</CardTitle>
          <CardDescription>
            Give one key-pass to each employee. They use it once to join your organisation and start their assessment, on the join page ({`${window.location.origin}/join`}) or in the Stop FRA app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kp-quantity">How many</Label>
              <Input id="kp-quantity" type="number" min={1} max={500} className="w-28" value={quantity}
                aria-invalid={!!formError} onChange={(e) => { setQuantity(e.target.value); setFormError(null); }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="keypass-valid-for">Valid for</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger id="keypass-valid-for" className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['7', '14', '30', '60', '90', '180', '365'].map((d) => <SelectItem key={d} value={d}>{d} days</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generate} disabled={isGenerating}>
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Create key-passes
            </Button>
          </div>
          {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}

          {newCodes && (
            <div className="rounded-md border bg-muted/30 p-4 space-y-3" role="status">
              <p className="text-sm font-medium">
                {newCodes.codes.length} new key-pass{newCodes.codes.length === 1 ? '' : 'es'}, valid until {formatDate(newCodes.expiresAt)}
              </p>
              <p className="font-mono text-sm break-all">{newCodes.codes.join('  ')}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => copyText(newCodes.codes.join('\n'), 'Codes copied')}>
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" /> Copy all
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyText(newCodes.codes.map(joinLink).join('\n'), 'Join links copied')}>
                  <Link2 className="mr-2 h-4 w-4" aria-hidden="true" /> Copy join links
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadCodes(newCodes.codes, newCodes.expiresAt)}>
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Download CSV
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle className="text-lg">All key-passes ({visible.length})</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" aria-label="Filter key-passes by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="used">Redeemed</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : visible.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No key-passes yet. Create some above to invite your team.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Redeemed by</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((k) => (
                    <TableRow key={k.code}>
                      <TableCell className="font-mono text-sm">{k.code}</TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_STYLE[k.status]}>{STATUS_LABEL[k.status] ?? k.status}</Badge></TableCell>
                      <TableCell>{formatDate(k.createdAt)}</TableCell>
                      <TableCell>{formatDate(k.expiresAt)}</TableCell>
                      <TableCell>
                        {k.status === 'used'
                          ? <>{(k.usedByUserId && userNames[k.usedByUserId]) || 'Employee'} <span className="text-muted-foreground text-xs">{formatDate(k.usedAt)}</span></>
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {k.status === 'available' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => copyText(joinLink(k.code), 'Join link copied')} aria-label={`Copy join link for key-pass ${k.code}`}>
                              <Link2 className="mr-1 h-4 w-4" aria-hidden="true" /> Copy link
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => revoke(k.code)} aria-label={`Revoke key-pass ${k.code}`}>Revoke</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
