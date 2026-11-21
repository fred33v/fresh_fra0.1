import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  professionalActionLabels,
  type ProfessionalAction,
  type ProfessionalScope,
  type ProfessionalSubject,
} from '@/lib/professional';
const base = '/api/v1/professional';
export default function ProfessionalScopes({ applicationId }: { applicationId?: string }) {
  const { user } = useAuth(),
    client = useQueryClient();
  const [open, setOpen] = useState(false),
    [subject, setSubject] = useState(''),
    [evidence, setEvidence] = useState(''),
    [actions, setActions] = useState<ProfessionalAction[]>(['deliver']),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const catalog = useQuery({
    queryKey: ['professional-subjects', user?.userId, user?.organisationId],
    queryFn: () => api.get<ProfessionalSubject[]>(`${base}/subjects`),
    enabled: open,
  });
  const key = ['professional-scopes', user?.userId, user?.organisationId, applicationId ?? 'me'];
  const list = useQuery({
    queryKey: key,
    queryFn: () =>
      api.get<ProfessionalScope[]>(
        applicationId ? `${base}/applications/${applicationId}/scopes` : `${base}/me/scopes`
      ),
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });
  const scopes = Array.isArray(list.data) ? list.data : [],
    subjects = Array.isArray(catalog.data) ? catalog.data : [];
  const chosen = subjects.find((s) => `${s.id}:${s.version}` === subject) ?? subjects[0];
  const request = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    setError('');
    const old = scopes.find(
      (s) => s.subjectId === chosen.id && s.subjectVersion === chosen.version
    );
    try {
      await api.post(`${base}/me/scopes`, {
        subjectId: chosen.id,
        subjectVersion: chosen.version,
        revision: old?.revision ?? 0,
        actions,
        evidence,
      });
      setEvidence('');
      await client.invalidateQueries({ queryKey: key });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scope request failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Professional subjects & scopes</h2>
      <p className="text-sm text-muted-foreground">
        Platform permissions to deliver, assess and issue course-completion certificates are
        reviewed separately. These permissions are not an external professional accreditation.
      </p>
      <Button variant="outline" onClick={() => setOpen(!open)}>
        {open ? 'Hide professional scopes' : 'Manage professional scopes'}
      </Button>
      {open && (
        <>
          {(list.isPending || catalog.isPending) && (
            <p role="status">Loading subject authorisations…</p>
          )}
          {(list.isError || catalog.isError) && (
            <p role="alert">{list.error?.message ?? catalog.error?.message}</p>
          )}
          {error && <p role="alert">{error}</p>}
          {scopes.length === 0 && !list.isPending && <p>No subject authority has been granted.</p>}
          {scopes.map((s) => (
            <article key={s.id} className="space-y-3 rounded border p-3">
              <h3 className="font-semibold">
                {subjects.find((t) => t.id === s.subjectId && t.version === s.subjectVersion)
                  ?.title ?? s.subjectId}{' '}
                · {s.subjectVersion}
              </h3>
              <p>
                {s.status} · revision {s.revision} ·{' '}
                {s.effective ? 'Current authority' : 'Not currently effective'}
              </p>
              <p className="text-sm">
                Requested: {s.requestedActions.map((k) => professionalActionLabels[k]).join(', ')}
                <br />
                Granted: {s.actions.map((k) => professionalActionLabels[k]).join(', ') || 'None'}
              </p>
              {s.validFrom && (
                <p className="text-sm">
                  {new Date(s.validFrom).toLocaleString('en-GB')} –{' '}
                  {s.validUntil ? new Date(s.validUntil).toLocaleString('en-GB') : ''}
                </p>
              )}
              <p className="whitespace-pre-wrap text-sm">Candidate evidence: {s.evidence}</p>
              {s.reason && (
                <p className="whitespace-pre-wrap text-sm">Review decision: {s.reason}</p>
              )}
              {applicationId && s.status !== 'revoked' && (
                <ScopeReview
                  key={`${s.id}:${s.revision}`}
                  scope={s}
                  onSaved={async () => {
                    await client.invalidateQueries({ queryKey: key });
                    await client.invalidateQueries({
                      queryKey: ['professional-assignment-scopes'],
                    });
                  }}
                />
              )}
            </article>
          ))}
          {!applicationId && (
            <form
              className="space-y-3 border-t pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void request();
              }}
            >
              <h3 className="font-semibold">Request or revise a subject scope</h3>
              <Label htmlFor="professional-subject">Subject / course version</Label>
              <select
                id="professional-subject"
                className="block w-full rounded border bg-background p-2"
                value={chosen ? `${chosen.id}:${chosen.version}` : ''}
                onChange={(e) => setSubject(e.target.value)}
                required
              >
                {subjects.map((s) => (
                  <option key={`${s.id}:${s.version}`} value={`${s.id}:${s.version}`}>
                    {s.title} · {s.version}
                  </option>
                ))}
              </select>
              <fieldset>
                <legend>Requested rights</legend>
                {Object.entries(professionalActionLabels).map(([value, label]) => (
                  <label className="mt-2 flex gap-2 text-sm" key={value}>
                    <input
                      type="checkbox"
                      checked={actions.includes(value as ProfessionalAction)}
                      onChange={(e) =>
                        setActions(
                          e.target.checked
                            ? [...actions, value as ProfessionalAction]
                            : actions.filter((a) => a !== value)
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <Label htmlFor="professional-evidence">
                Qualifications, experience and demonstration evidence
              </Label>
              <Textarea
                id="professional-evidence"
                required
                minLength={20}
                maxLength={4000}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Describe or reference evidence for human verification. An active grant must be
                suspended before amendment. Revocation is final for this grant.
              </p>
              <Button disabled={busy || !chosen || !actions.includes('deliver')}>
                {busy ? 'Submitting…' : 'Submit subject scope request'}
              </Button>
            </form>
          )}
          {!applicationId && (
            <Button asChild variant="outline">
              <Link to="/professional-training">Open professional training console</Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => void list.refetch()}>
            Refresh subject authority
          </Button>
        </>
      )}
    </section>
  );
}
function ScopeReview({
  scope,
  onSaved,
}: {
  scope: ProfessionalScope;
  onSaved: () => Promise<unknown>;
}) {
  const [status, setStatus] = useState('approved'),
    [reason, setReason] = useState(''),
    [rights, setRights] = useState<ProfessionalAction[]>([]);
  const [from, setFrom] = useState(''),
    [until, setUntil] = useState(''),
    [qualification, setQualification] = useState(''),
    [demo, setDemo] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`${base}/scopes/${scope.id}/review`, {
        revision: scope.revision,
        status,
        reason,
        ...(status === 'approved'
          ? {
              actions: rights,
              validFrom: new Date(from).toISOString(),
              validUntil: new Date(until).toISOString(),
              qualificationCheck: qualification,
              demonstrationCheck: demo,
              checksConfirmed: confirmed,
            }
          : {}),
      });
      await onSaved();
      setConfirmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scope review failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="space-y-3 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h4 className="font-semibold">Review subject authority</h4>
      <Label htmlFor={`scope-${scope.id}-decision`}>Subject decision</Label>
      <select
        id={`scope-${scope.id}-decision`}
        className="block rounded border bg-background p-2"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setConfirmed(false);
        }}
      >
        <option value="approved">Approve explicit rights</option>
        {scope.status === 'requested' && <option value="declined">Decline request</option>}
        {scope.status === 'approved' && <option value="suspended">Suspend authority</option>}
        <option value="revoked">Revoke permanently</option>
      </select>
      <Label htmlFor={`scope-${scope.id}-reason`}>
        Subject review reason (visible to candidate)
      </Label>
      <Textarea
        id={`scope-${scope.id}-reason`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        minLength={10}
        maxLength={2000}
      />
      {status === 'approved' && (
        <>
          <fieldset>
            <legend>Rights explicitly granted</legend>
            {scope.requestedActions.map((k) => (
              <label key={k} className="mt-2 flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rights.includes(k)}
                  onChange={(e) =>
                    setRights(e.target.checked ? [...rights, k] : rights.filter((v) => v !== k))
                  }
                />
                {professionalActionLabels[k]}
              </label>
            ))}
          </fieldset>
          <Label htmlFor={`scope-${scope.id}-from`}>Authority valid from</Label>
          <Input
            id={`scope-${scope.id}-from`}
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
          <Label htmlFor={`scope-${scope.id}-until`}>Authority valid until</Label>
          <Input
            id={`scope-${scope.id}-until`}
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            required
          />
          <Label htmlFor={`scope-${scope.id}-qual`}>
            Qualification verification record (reviewers only)
          </Label>
          <Textarea
            id={`scope-${scope.id}-qual`}
            required
            minLength={10}
            maxLength={4000}
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
          />
          <Label htmlFor={`scope-${scope.id}-demo`}>
            Training demonstration verification (reviewers only)
          </Label>
          <Textarea
            id={`scope-${scope.id}-demo`}
            required
            minLength={10}
            maxLength={4000}
            value={demo}
            onChange={(e) => setDemo(e.target.value)}
          />
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I verified the evidence and the explicit subject rights for this dated period.
          </label>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <Button
        disabled={busy || (status === 'approved' && (!confirmed || !rights.includes('deliver')))}
      >
        {busy ? 'Recording…' : 'Record subject decision'}
      </Button>
    </form>
  );
}
