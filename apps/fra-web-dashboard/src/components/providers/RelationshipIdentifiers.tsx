import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
const base = '/api/v1/relationship-identifiers';
type Identifier = {
  id: string;
  code: string;
  kind: 'employee' | 'supplier' | 'provider_code';
  status: 'active' | 'suspended' | 'revoked';
  revision: number;
  reason?: string;
};
export default function RelationshipIdentifiers({
  applicationId,
  employeeUserId,
}: {
  applicationId?: string;
  employeeUserId?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const admin = !!(applicationId || employeeUserId);
  const key = [
    'relationship-identifiers',
    user?.userId,
    user?.organisationId,
    applicationId ?? employeeUserId ?? 'me',
  ];
  const result = useQuery({
    queryKey: key,
    queryFn: () =>
      api.get<Identifier[]>(
        admin
          ? `${base}/review?${applicationId ? 'applicationId=' + encodeURIComponent(applicationId) : 'userId=' + encodeURIComponent(employeeUserId!)}`
          : `${base}/me`
      ),
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });
  const cache = useQueryClient();
  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-lg font-semibold">Relationship identifiers</h2>
      <p className="text-sm text-muted-foreground">
        EMP identifies a verified employment record; SUP identifies a supplier relationship; PRV is
        the existing sales reference. These identifiers do not grant login, payroll eligibility or
        professional certification rights.
      </p>
      <Button variant="outline" onClick={() => setOpen(!open)}>
        {open ? 'Hide identifiers' : 'Manage identifiers'}
      </Button>
      {open && (
        <>
          {result.isPending && <p role="status">Loading identifiers…</p>}
          {result.isError && <p role="alert">{result.error.message}</p>}
          {result.data?.length === 0 && <p>No identifiers issued.</p>}
          {Array.isArray(result.data) &&
            result.data.map((i) => (
              <article key={i.id} className="space-y-2 rounded border p-3">
                <p className="break-all font-mono">{i.code}</p>
                <p>
                  {i.kind} · {i.status} · revision {i.revision}
                </p>
                {admin && (
                  <IdentifierControl
                    key={`${i.id}:${i.revision}`}
                    value={i}
                    onSaved={async () => {
                      await cache.invalidateQueries({ queryKey: key });
                      await cache.invalidateQueries({ queryKey: ['professional-scopes'] });
                      await cache.invalidateQueries({
                        queryKey: ['professional-assignment-scopes'],
                      });
                    }}
                  />
                )}
              </article>
            ))}
        </>
      )}
    </section>
  );
}
function IdentifierControl({
  value,
  onSaved,
}: {
  value: Identifier;
  onSaved: () => Promise<unknown>;
}) {
  const [status, setStatus] = useState(value.status === 'active' ? 'suspended' : 'active'),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [history, setHistory] = useState<Array<{
      revision: number;
      occurred_at: string;
      snapshot: { status: string; reason: string; actor_id: string | null };
    }> | null>(null);
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.post(`${base}/${value.id}/status`, { revision: value.revision, status, reason });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Identifier decision failed');
    } finally {
      setBusy(false);
    }
  }
  async function audit() {
    setError('');
    try {
      const result = await api.get<{ events: NonNullable<typeof history> }>(
        `${base}/${value.id}/events`
      );
      setHistory(result.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit verification failed');
    }
  }
  return (
    <>
      {value.status !== 'revoked' ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Label htmlFor={`${value.id}-status`}>Identifier status</Label>
          <select
            id={`${value.id}-status`}
            className="block rounded border bg-background p-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {value.status !== 'active' && <option value="active">Reactivate</option>}
            {value.status !== 'suspended' && <option value="suspended">Suspend</option>}
            <option value="revoked">Revoke permanently</option>
          </select>
          <Label htmlFor={`${value.id}-reason`}>Identifier decision reason</Label>
          <Textarea
            id={`${value.id}-reason`}
            minLength={10}
            maxLength={2000}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Manual suspension requires explicit reactivation. Revocation is permanent. Historical
            sales and earned accounting entries are retained.
          </p>
          <Button disabled={busy}>Record identifier decision</Button>
        </form>
      ) : (
        <p>Revoked permanently; this code cannot be reactivated or reassigned.</p>
      )}
      <Button variant="outline" onClick={() => void audit()}>
        Verify identifier history
      </Button>
      {error && <p role="alert">{error}</p>}
      {history && (
        <ol className="space-y-2">
          {history.map((e) => (
            <li key={e.revision}>
              Revision {e.revision}: {e.snapshot.status} ·{' '}
              {new Date(e.occurred_at).toLocaleString('en-GB')} · {e.snapshot.reason} · actor{' '}
              {e.snapshot.actor_id ?? 'migration/system'}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
export function EmployeeIdentifierRegistry() {
  const [userId, setUserId] = useState(''),
    [organisationId, setOrganisationId] = useState(''),
    [agreement, setAgreement] = useState(''),
    [reason, setReason] = useState(''),
    [verified, setVerified] = useState(false),
    [lookup, setLookup] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const cache = useQueryClient();
  async function issue() {
    setBusy(true);
    setError('');
    try {
      await api.post(`${base}/employees`, {
        userId,
        organisationId,
        agreementDocumentId: agreement,
        reason,
        employmentVerified: verified,
      });
      setLookup(userId);
      setVerified(false);
      await cache.invalidateQueries({ queryKey: ['relationship-identifiers'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Employee identifier issuance failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Employee identifier register</h2>
      <p>
        An identifier records a relationship already verified by authorised staff. It does not
        create an employment contract, determine employment status or enrol someone in payroll. Use
        a retained completed document titled “Employment agreement …” signed by the employee.
      </p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void issue();
        }}
      >
        <Label htmlFor="employee-user">Employee account UUID</Label>
        <Input
          id="employee-user"
          required
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <Label htmlFor="employee-org">Employee organisation UUID</Label>
        <Input
          id="employee-org"
          required
          value={organisationId}
          onChange={(e) => setOrganisationId(e.target.value)}
        />
        <Label htmlFor="employee-agreement">Signed employment agreement UUID</Label>
        <Input
          id="employee-agreement"
          required
          value={agreement}
          onChange={(e) => setAgreement(e.target.value)}
        />
        <Label htmlFor="employee-reason">Employment verification record</Label>
        <Textarea
          id="employee-reason"
          minLength={10}
          maxLength={2000}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={verified}
            required
            onChange={(e) => setVerified(e.target.checked)}
          />
          I verified this employment relationship and its signed agreement.
        </label>
        <Button disabled={busy || !verified}>Issue employee identifier</Button>
      </form>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setLookup(userId);
        }}
      >
        <Button variant="outline" disabled={!userId}>
          Look up identifiers for this account
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {lookup && <RelationshipIdentifiers key={lookup} employeeUserId={lookup} />}
    </section>
  );
}
