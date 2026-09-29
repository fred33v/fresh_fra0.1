import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, KeyRound, Send, Trash2, Webhook } from 'lucide-react';
import { toast } from 'sonner';

const logger = createLogger('Integrations');

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: number;
}

const EVENT_LABELS: Record<string, string> = {
  'assessment.submitted': 'Assessment submitted',
  'keypass.used': 'Key-pass used',
  'risk.created': 'Risk created',
  'risk.updated': 'Risk updated',
  'risk.high_priority': 'Risk became high priority',
};

const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');

/** Shows a secret once with a copy button; it cannot be retrieved again. */
function RevealedSecret({ label, value, onDismiss }: { label: string; value: string; onDismiss: () => void }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed — select the text and copy it manually');
    }
  };
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-4 space-y-2" role="status">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
        {label} — copy it now. It will not be shown again.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button variant="outline" size="icon" onClick={copy} aria-label="Copy"><Copy className="h-4 w-4" /></Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss}>I have saved it</Button>
    </div>
  );
}

function ApiKeysCard() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get<ApiKey[]>('/api/v1/api-keys').then(setKeys)
    .catch((err: unknown) => logger.error('Failed to load API keys', err));

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) {
      setNameError('Enter a name so you can recognise the key later');
      return;
    }
    setBusy(true);
    try {
      const data = await api.post<ApiKey & { key: string }>('/api/v1/api-keys', { name: name.trim() });
      setNewKey(data.key);
      setName('');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (key: ApiKey) => {
    if (!window.confirm(`Revoke "${key.name}"? Anything using it will stop working immediately.`)) return;
    try {
      await api.delete(`/api/v1/api-keys/${key.id}`);
      toast.success('API key revoked');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke key');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5" aria-hidden="true" /> API keys</CardTitle>
        <CardDescription>
          Read-only keys for GRC tools and custom dashboards. Send as <code className="text-xs">Authorization: Bearer &lt;key&gt;</code> to
          analytics, compliance, risk-register and assessment endpoints.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {newKey && <RevealedSecret label="Your new API key" value={newKey} onDismiss={() => setNewKey(null)} />}

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5 flex-1 min-w-[12rem]">
            <Label htmlFor="key-name">Key name</Label>
            <Input
              id="key-name" placeholder="e.g. GRC nightly sync" value={name} aria-invalid={!!nameError}
              onChange={(e) => { setName(e.target.value); setNameError(null); }}
            />
          </div>
          <Button onClick={create} disabled={busy}>Create key</Button>
        </div>
        {nameError && <p className="text-sm text-destructive" role="alert">{nameError}</p>}

        {keys.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id} className={k.revokedAt ? 'opacity-60' : undefined}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs">{k.keyPrefix}…</TableCell>
                    <TableCell>{formatDate(k.createdAt)}</TableCell>
                    <TableCell>{formatDate(k.lastUsedAt)}</TableCell>
                    <TableCell className="text-right">
                      {k.revokedAt ? (
                        <Badge variant="outline">Revoked</Badge>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => revoke(k)} aria-label={`Revoke ${k.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
  );
}

function WebhooksCard() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['assessment.submitted', 'risk.high_priority']);
  const [formError, setFormError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get<WebhookEndpoint[]>('/api/v1/webhook-endpoints').then(setEndpoints)
    .catch((err: unknown) => logger.error('Failed to load webhooks', err));

  useEffect(() => { load(); }, []);

  const toggleEvent = (event: string, checked: boolean) => {
    setEvents((prev) => (checked ? [...prev, event] : prev.filter((e) => e !== event)));
    setFormError(null);
  };

  const create = async () => {
    if (!/^https?:\/\/.+/.test(url.trim())) {
      setFormError('Enter the full URL of your endpoint, starting with https://');
      return;
    }
    if (events.length === 0) {
      setFormError('Choose at least one event');
      return;
    }
    setBusy(true);
    try {
      const data = await api.post<WebhookEndpoint & { secret: string }>('/api/v1/webhook-endpoints', { url: url.trim(), events });
      setNewSecret(data.secret);
      setUrl('');
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to add endpoint');
    } finally {
      setBusy(false);
    }
  };

  const test = async (endpoint: WebhookEndpoint) => {
    try {
      const result = await api.post<{ delivered: boolean; status: number }>(`/api/v1/webhook-endpoints/${endpoint.id}/test`);
      if (result.delivered) toast.success(`Test delivered (HTTP ${result.status})`);
      else toast.error(result.status ? `Endpoint responded with HTTP ${result.status}` : 'Endpoint could not be reached');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    }
  };

  const remove = async (endpoint: WebhookEndpoint) => {
    if (!window.confirm(`Stop sending events to ${endpoint.url}?`)) return;
    try {
      await api.delete(`/api/v1/webhook-endpoints/${endpoint.id}`);
      toast.success('Webhook removed');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove webhook');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Webhook className="h-5 w-5" aria-hidden="true" /> Webhooks</CardTitle>
        <CardDescription>
          Push events to your SIEM or GRC platform. Each request carries an <code className="text-xs">X-StopFRA-Signature</code> header:
          an HMAC-SHA256 of <code className="text-xs">timestamp.body</code> using your signing secret.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {newSecret && <RevealedSecret label="Your signing secret" value={newSecret} onDismiss={() => setNewSecret(null)} />}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url" type="url" placeholder="https://siem.example.com/hooks/stopfra" value={url}
              aria-invalid={!!formError} onChange={(e) => { setUrl(e.target.value); setFormError(null); }}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-1">Events</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(EVENT_LABELS).map(([event, label]) => (
                <label key={event} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={events.includes(event)} onCheckedChange={(c) => toggleEvent(event, c === true)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
          <Button onClick={create} disabled={busy}>Add endpoint</Button>
        </div>

        {endpoints.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Last delivery</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs break-all">{w.url}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {w.events.map((e) => <Badge key={e} variant="secondary">{EVENT_LABELS[e] ?? e}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {w.lastDeliveryAt ? (
                        <>
                          {formatDate(w.lastDeliveryAt)}{' '}
                          <Badge variant="outline" className={w.lastDeliveryStatus && w.lastDeliveryStatus < 300 ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'}>
                            {w.lastDeliveryStatus || 'failed'}
                          </Badge>
                        </>
                      ) : 'Never'}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => test(w)} aria-label={`Send test event to ${w.url}`}>
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(w)} aria-label={`Remove ${w.url}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Integrations() {
  return (
    <Layout>
      <div className="container py-8 lg:py-12 max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Integrations</h1>
          <p className="text-muted-foreground">Connect Stop FRA to your GRC, SIEM and reporting tools</p>
        </div>
        <ApiKeysCard />
        <WebhooksCard />
      </div>
    </Layout>
  );
}
