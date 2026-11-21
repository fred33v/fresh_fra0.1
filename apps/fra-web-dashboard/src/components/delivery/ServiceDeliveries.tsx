import {Link} from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
const base = '/api/v1/service-delivery';
type Summary = {
  id: string;
  title: string;
  status: string;
  revision: number;
  providerName: string;
};
type Detail = {
  delivery: {
    id: string;
    title: string;
    status: string;
    revision: number;
    starts_at: string;
    ends_at: string;
    reason: string;
    evidence_summary: string | null;
  };
  permissions: { provider: boolean; customer: boolean; reviewer: boolean };
  attendance: Array<{ learner_id: string; learner_name: string; status: string; revision: number }>;
  learners: Array<{ id: string; name: string; completedAt: string | null }>;
  files: Array<{ id: string; filename: string; bytes: number; sha256: string }>;
};
export default function ServiceDeliveries({
  applicationId,
  review = false,
}: {
  applicationId?: string;
  review?: boolean;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(''),
    [page, setPage] = useState(0);
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (review) params.set('view', 'review');
  if (applicationId) params.set('applicationId', applicationId);
  const key = [
    'service-deliveries',
    user?.userId,
    user?.organisationId,
    applicationId ?? 'all',
    review,
    page,
  ];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<Summary[]>(`${base}/records?${params}`),
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });
  const cache = useQueryClient();
  return (
    <section className="space-y-4 rounded border p-4">
      <h2 className="text-xl font-semibold">Service delivery</h2>
      <p>
        Attendance, service evidence and customer decisions are separate from learner certificates
        and payment disputes. This workflow does not send payments or create refunds.
      </p>
      <Button variant="outline" onClick={() => setOpen(!open)}>
        {open ? 'Hide deliveries' : 'Open deliveries'}
      </Button>
      {open && (
        <>
          {review && applicationId && (
            <CreateDelivery
              applicationId={applicationId}
              onCreated={async (id) => {
                await cache.invalidateQueries({ queryKey: key });
                setSelected(id);
              }}
            />
          )}
          {query.isPending && <p role="status">Loading deliveries…</p>}
          {query.isError && <p role="alert">{query.error.message}</p>}
          {query.data?.length === 0 && <p>No service deliveries yet.</p>}
          {Array.isArray(query.data) &&
            query.data.map((d) => (
              <article
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"
              >
                <p>
                  {d.title} · {d.providerName} · {d.status}
                </p>
                <Button variant="outline" onClick={() => setSelected(d.id)}>
                  Review delivery {d.title}
                </Button>
              </article>
            ))}
          <p className="text-xs text-muted-foreground">Shows up to 100 deliveries per page.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Refresh delivery list
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 0 || query.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Previous deliveries
            </Button>
            <span>Page {page + 1}</span>
            <Button
              variant="outline"
              disabled={query.isFetching || query.data?.length !== 100}
              onClick={() => setPage(page + 1)}
            >
              Next deliveries
            </Button>
          </div>
          {selected && (
            <DeliveryDetail
              key={selected}
              id={selected}
              onSaved={() => cache.invalidateQueries({ queryKey: key })}
            />
          )}
        </>
      )}
    </section>
  );
}
function CreateDelivery({
  applicationId,
  onCreated,
}: {
  applicationId: string;
  onCreated: (id: string) => Promise<unknown>;
}) {
  const [org, setOrg] = useState(''),
    [lookup, setLookup] = useState(''),
    [contact, setContact] = useState(''),
    [session, setSession] = useState(''),
    [title, setTitle] = useState(''),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { user } = useAuth();
  const options = useQuery({
    queryKey: [
      'delivery-create-options',
      user?.userId,
      user?.organisationId,
      applicationId,
      lookup,
    ],
    queryFn: () =>
      api.get<{
        sessions: Array<{
          assignmentId: string;
          sessionId: string;
          reference: string;
          title: string;
        }>;
        contacts: Array<{ id: string; name: string }>;
      }>(
        `${base}/options?applicationId=${encodeURIComponent(applicationId)}${lookup ? '&customerOrganisationId=' + encodeURIComponent(lookup) : ''}`
      ),
  });
  const choice =
    options.data?.sessions.find((s) => s.sessionId === session) ?? options.data?.sessions[0];
  const customer =
    options.data?.contacts.find((c) => c.id === contact) ?? options.data?.contacts[0];
  async function create() {
    if (!choice || !customer || org !== lookup) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.post<{ id: string }>(`${base}/records`, {
        applicationId,
        assignmentId: choice.assignmentId,
        sessionId: choice.sessionId,
        customerUserId: customer.id,
        customerOrganisationId: lookup,
        title,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        reason,
      });
      await onCreated(result.id);
      setTitle('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delivery creation failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded border p-3">
      <h3 className="font-semibold">Assign a customer delivery</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLookup(org);
          setContact('');
        }}
      >
        <Label htmlFor={`customer-org-${applicationId}`}>Customer organisation reference</Label>
        <Input
          id={`customer-org-${applicationId}`}
          required
          value={org}
          onChange={(e) => setOrg(e.target.value)}
        />
        <Button variant="outline">Find verified customer contacts</Button>
      </form>
      {options.isError && <p role="alert">{options.error.message}</p>}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Label htmlFor={`delivery-session-${applicationId}`}>
          Accepted assignment and authorised class
        </Label>
        <select
          id={`delivery-session-${applicationId}`}
          required
          className="block w-full rounded border bg-background p-2"
          value={choice?.sessionId ?? ''}
          onChange={(e) => setSession(e.target.value)}
        >
          <option value="">Choose class</option>
          {options.data?.sessions.map((s) => (
            <option key={s.sessionId} value={s.sessionId}>
              {s.reference} · {s.title}
            </option>
          ))}
        </select>
        <Label htmlFor={`delivery-contact-${applicationId}`}>
          Designated customer decision-maker
        </Label>
        <select
          id={`delivery-contact-${applicationId}`}
          required
          className="block w-full rounded border bg-background p-2"
          value={customer?.id ?? ''}
          onChange={(e) => setContact(e.target.value)}
        >
          <option value="">Choose verified customer contact</option>
          {options.data?.contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Label htmlFor={`delivery-title-${applicationId}`}>Delivery title</Label>
        <Input
          id={`delivery-title-${applicationId}`}
          required
          minLength={2}
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Label htmlFor={`delivery-start-${applicationId}`}>Scheduled start</Label>
        <Input
          id={`delivery-start-${applicationId}`}
          type="datetime-local"
          required
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <Label htmlFor={`delivery-end-${applicationId}`}>Scheduled end</Label>
        <Input
          id={`delivery-end-${applicationId}`}
          type="datetime-local"
          required
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
        <Label htmlFor={`delivery-reason-${applicationId}`}>Customer assignment reason</Label>
        <Textarea
          id={`delivery-reason-${applicationId}`}
          required
          minLength={10}
          maxLength={4000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button disabled={busy || !choice || !customer || org !== lookup}>
          Create customer delivery
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function DeliveryDetail({ id, onSaved }: { id: string; onSaved: () => Promise<unknown> }) {
  const { user } = useAuth(),
    cache = useQueryClient();
  const key = ['service-delivery-detail', user?.userId, user?.organisationId, id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<Detail>(`${base}/${id}`),
    refetchInterval: 30000,
  });
  const [reason, setReason] = useState(''),
    [summary, setSummary] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [learner, setLearner] = useState(''),
    [attendance, setAttendance] = useState('present'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [history, setHistory] = useState<Array<{
      revision: number;
      occurred_at: string;
      snapshot: { status: string; reason: string; evidence_summary?: string };
    }> | null>(null);
  const detail = query.data,
    d = detail?.delivery,
    rights = detail?.permissions;
  async function saved() {
    await cache.invalidateQueries({ queryKey: key });
    await onSaved();
    setHistory(null);
    setReason('');
  }
  async function work(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delivery update failed');
    } finally {
      setBusy(false);
    }
  }
  const act = (action: string) =>
    work(() =>
      api.post(`${base}/${id}/action`, {
        revision: d?.revision,
        action,
        reason,
        ...(action === 'submit' ? { evidenceSummary: summary } : {}),
      })
    );
  async function upload() {
    if (!file || !d) return;
    if (file.size < 8 || file.size > 524288) {
      setError('Evidence files must be between 8 bytes and 512 KiB');
      return;
    }
    const form = new FormData();
    form.set('file', file);
    form.set('revision', String(d.revision));
    await work(() => api.upload(`${base}/${id}/files`, form));
    setFile(null);
  }
  async function viewHistory() {
    setError('');
    try {
      const result = await api.get<{ verified: boolean; events: NonNullable<typeof history> }>(
        `${base}/${id}/history`
      );
      if (!result.verified) throw new Error('History did not verify');
      setHistory(result.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'History verification failed');
    }
  }
  if (query.isError) return <p role="alert">{query.error.message}</p>;
  if (!detail || !d) return <p role="status">Loading delivery detail…</p>;
  const disabled = busy || reason.trim().length < 10;
  return (
    <article className="space-y-4 border-t pt-4">
      <h3 className="text-xl font-semibold">{d.title}</h3>
      {rights?.reviewer&&<Link className="underline" to={`/finance?delivery=${encodeURIComponent(id)}`}>Open service fee finance review</Link>}
      <p>
        {d.status} · revision {d.revision} · {new Date(d.starts_at).toLocaleString('en-GB')} –{' '}
        {new Date(d.ends_at).toLocaleString('en-GB')}
      </p>
      <p className="whitespace-pre-wrap">Latest record: {d.reason}</p>
      {d.evidence_summary && (
        <p className="whitespace-pre-wrap">Submitted service completion: {d.evidence_summary}</p>
      )}
      <h4 className="font-semibold">Attendance and learner completion</h4>
      <p>
        Joining the class is enrolment. “Present” is the trainer's explicit attendance declaration.
        Learner course completion remains a separate server record.
      </p>
      {detail.learners.map((l) => (
        <p key={l.id}>
          {l.name}:{' '}
          {detail.attendance.find((a) => a.learner_id === l.id)?.status ??
            'Attendance not recorded'}{' '}
          · {l.completedAt ? 'Course completion recorded' : 'Course not completed'}
        </p>
      ))}
      {detail.attendance
        .filter((a) => !detail.learners.some((l) => l.id === a.learner_id))
        .map((a) => (
          <p key={a.learner_id}>
            {a.learner_name}: {a.status} · retained attendance; current learner progress
            unavailable.
          </p>
        ))}
      <h4 className="font-semibold">Retained delivery evidence</h4>
      {detail.files.length === 0 && <p>No evidence uploaded.</p>}
      {detail.files.map((f) => (
        <div key={f.id} className="space-y-1 rounded border p-2">
          <p>
            {f.filename} · {f.bytes} bytes
          </p>
          <p className="break-all text-xs">SHA-256 {f.sha256}</p>
          <Button
            variant="outline"
            onClick={() =>
              void api
                .download(`${base}/${id}/files/${f.id}`, f.filename)
                .catch((e) => setError(e instanceof Error ? e.message : 'Evidence download failed'))
            }
          >
            Download evidence {f.filename}
          </Button>
        </div>
      ))}
      <Label htmlFor={`delivery-action-reason-${id}`}>Decision or attendance reason</Label>
      <Textarea
        id={`delivery-action-reason-${id}`}
        minLength={10}
        maxLength={2000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {rights?.provider && d.status === 'in_progress' && (
        <div className="space-y-3">
          <h4 className="font-semibold">Record attendance</h4>
          <Label htmlFor={`delivery-learner-${id}`}>Enrolled customer learner</Label>
          <select
            id={`delivery-learner-${id}`}
            className="block w-full rounded border bg-background p-2"
            value={learner || detail.learners[0]?.id || ''}
            onChange={(e) => setLearner(e.target.value)}
          >
            {detail.learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <Label htmlFor={`delivery-attendance-${id}`}>Attendance declaration</Label>
          <select
            id={`delivery-attendance-${id}`}
            className="block rounded border bg-background p-2"
            value={attendance}
            onChange={(e) => setAttendance(e.target.value)}
          >
            {['present', 'absent', 'excused'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button
            disabled={disabled || !detail.learners.length}
            onClick={() =>
              void work(() =>
                api.post(`${base}/${id}/attendance`, {
                  revision: d.revision,
                  learnerId: learner || detail.learners[0]?.id,
                  status: attendance,
                  reason,
                })
              )
            }
          >
            Record attendance
          </Button>
          <Label htmlFor={`delivery-file-${id}`}>
            Evidence file (PDF, PNG or JPEG, up to 512 KiB)
          </Label>
          <Input
            id={`delivery-file-${id}`}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" disabled={busy || !file} onClick={() => void upload()}>
            Upload retained evidence
          </Button>
          <Label htmlFor={`delivery-summary-${id}`}>Service completion and evidence summary</Label>
          <Textarea
            id={`delivery-summary-${id}`}
            minLength={20}
            maxLength={4000}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <Button
            disabled={disabled || summary.trim().length < 20}
            onClick={() => void act('submit')}
          >
            Submit delivery for customer review
          </Button>
        </div>
      )}
      {rights?.provider && d.status === 'refused' && (
        <Button disabled={disabled} onClick={() => void act('reopen')}>
          Reopen refused delivery
        </Button>
      )}
      {rights?.customer && ['submitted', 'disputed'].includes(d.status) && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={disabled} onClick={() => void act('accept')}>
            Accept delivered service
          </Button>
          <Button variant="outline" disabled={disabled} onClick={() => void act('refuse')}>
            Refuse delivered service
          </Button>
        </div>
      )}
      {(rights?.customer || rights?.provider) &&
        ['submitted', 'accepted', 'refused'].includes(d.status) && (
          <Button variant="outline" disabled={disabled} onClick={() => void act('dispute')}>
            Open service dispute
          </Button>
        )}
      {rights?.reviewer && !rights.customer && ['in_progress', 'refused'].includes(d.status) && (
        <Button variant="outline" disabled={disabled} onClick={() => void act('cancel')}>
          Cancel uncompleted delivery
        </Button>
      )}
      {rights?.reviewer && !rights.customer && d.status === 'disputed' && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={disabled} onClick={() => void act('resolve_rework')}>
            Resolve dispute: request rework
          </Button>
          <Button variant="outline" disabled={disabled} onClick={() => void act('resolve_cancel')}>
            Resolve dispute: cancel delivery
          </Button>
        </div>
      )}
      <Button variant="outline" onClick={() => void viewHistory()}>
        Verify delivery history
      </Button>
      {history && (
        <ol className="space-y-2">
          {history.map((e) => (
            <li key={e.revision}>
              Revision {e.revision}: {e.snapshot.status} ·{' '}
              {new Date(e.occurred_at).toLocaleString('en-GB')} · {e.snapshot.reason}
              {e.snapshot.evidence_summary && <p>{e.snapshot.evidence_summary}</p>}
            </li>
          ))}
        </ol>
      )}
      {error && <p role="alert">{error}</p>}
      <Button variant="outline" onClick={() => void query.refetch()}>
        Refresh delivery detail
      </Button>
    </article>
  );
}
