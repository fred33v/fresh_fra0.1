import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  evidenceKindLabel,
  evidenceKinds,
  evidenceLimits,
  evidenceStatusLabel,
  kibibytes,
  type EvidenceDocument,
  type EvidenceKind,
} from '@/lib/providerEvidence';

const chip: Record<EvidenceDocument['status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  verified: 'bg-green-100 text-green-900',
  rejected: 'bg-red-100 text-red-900',
};

function useEvidence(base: string) {
  const { user } = useAuth();
  const key = ['provider-evidence', user?.userId, user?.organisationId, base];
  const query = useQuery({ queryKey: key, queryFn: () => api.get<EvidenceDocument[]>(`${base}/documents`) });
  return { key, query };
}

function Status({ document }: { document: EvidenceDocument }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${chip[document.status]}`}>
      {evidenceStatusLabel[document.status]}
    </span>
  );
}

/** The applicant's own documents: upload while the application is submitted or declined, download any time. */
export function ApplicantEvidence({ base, status }: { base: string; status: string }) {
  const client = useQueryClient();
  const { key, query } = useEvidence(base);
  const [kind, setKind] = useState<EvidenceKind | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [error, setError] = useState('');
  const documents = Array.isArray(query.data) ? query.data : [];
  const canUpload = ['submitted', 'declined'].includes(status);
  const full = documents.length >= evidenceLimits.maxFiles;

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set('kind', kind);
      form.set('file', file as File);
      return api.upload(`${base}/documents`, form);
    },
    onSuccess: async () => {
      setFile(null);
      setKind('');
      setFileKey((n) => n + 1);
      await client.invalidateQueries({ queryKey: key });
    },
  });

  function submit() {
    setError('');
    if (!kind) return setError('Choose what kind of document this is');
    if (!file) return setError('Choose a file to upload');
    if (file.size < evidenceLimits.minBytes || file.size > evidenceLimits.maxBytes)
      return setError('Files must be between 8 bytes and 512 KiB');
    upload.mutate();
  }

  return (
    <section className="space-y-3" aria-labelledby="evidence-heading">
      <h2 id="evidence-heading" className="text-xl font-semibold">Supporting documents</h2>
      <p className="text-sm text-muted-foreground">
        Add documents a reviewer needs to consider your application, such as identity, company
        registration or qualifications. PDF, PNG or JPEG, up to 512 KiB each and 10 files in total.
        Reviewers open them as downloads, and each decision is recorded.
      </p>
      {query.isPending && <p role="status">Loading your documents…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {Array.isArray(query.data) && documents.length === 0 && <p className="text-sm">No documents added yet.</p>}
      <ul className="space-y-2">
        {documents.map((d) => (
          <li key={d.id} className="min-w-0 rounded border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-all font-medium">{d.filename}</span>
              <Status document={d} />
            </div>
            <p className="text-muted-foreground">
              {evidenceKindLabel(d.kind)} · {kibibytes(d.sizeBytes)} · added{' '}
              {new Date(d.uploadedAt).toLocaleDateString('en-GB')}
            </p>
            {d.status === 'rejected' && d.decisionReason && (
              <p className="mt-1 break-words">Reviewer's reason: {d.decisionReason}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void api.download(`${base}/documents/${d.id}/file`, d.filename).catch((e: Error) => setError(e.message))}
            >
              Download {d.filename}
            </Button>
          </li>
        ))}
      </ul>
      {canUpload ? (
        <div className="space-y-3 rounded border p-3">
          <div>
            <Label htmlFor="evidence-kind">Document type</Label>
            <select
              id="evidence-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as EvidenceKind | '')}
              className="mt-1 block w-full rounded border bg-background p-2"
              disabled={full}
            >
              <option value="">Choose…</option>
              {evidenceKinds.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="evidence-file">File</Label>
            <input
              key={fileKey}
              id="evidence-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="mt-1 block w-full text-sm"
              disabled={full}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {full && <p className="text-sm">You have added the maximum of 10 documents.</p>}
          {(error || upload.isError) && <p role="alert">{error || (upload.error as Error).message}</p>}
          <Button disabled={full || upload.isPending} onClick={submit}>
            {upload.isPending ? 'Uploading…' : 'Upload document'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Documents can be added while your application is submitted or declined.
        </p>
      )}
      {!canUpload && error && <p role="alert">{error}</p>}
    </section>
  );
}

/** Reviewer view of one application's documents: download, then verify or reject once. */
export function ReviewerEvidence({ applicationId }: { applicationId: string }) {
  const base = `/api/v1/provider-applications/${applicationId}`;
  const client = useQueryClient();
  const { key, query } = useEvidence(base);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const decide = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'verified' | 'rejected'; reason?: string }) =>
      api.post(`${base}/documents/${id}/decision`, { status, ...(reason ? { reason } : {}) }),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => setError(e.message),
  });
  const documents = Array.isArray(query.data) ? query.data : [];

  return (
    <section className="space-y-3" aria-label={`Evidence documents for application ${applicationId}`}>
      <h3 className="text-lg font-semibold">Evidence documents ({documents.length})</h3>
      {query.isPending && <p role="status">Loading evidence…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {Array.isArray(query.data) && documents.length === 0 && <p className="text-sm">The applicant has not added any documents.</p>}
      {error && <p role="alert">{error}</p>}
      <ul className="space-y-2">
        {documents.map((d) => {
          const reason = reasons[d.id] ?? '';
          return (
            <li key={d.id} className="min-w-0 space-y-2 rounded border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-all font-medium">{d.filename}</span>
                <Status document={d} />
              </div>
              <p className="text-muted-foreground">
                {evidenceKindLabel(d.kind)} · {kibibytes(d.sizeBytes)} · revision {d.applicationRevision} · added{' '}
                {new Date(d.uploadedAt).toLocaleDateString('en-GB')}
              </p>
              <p className="break-all font-mono text-xs text-muted-foreground">SHA-256 {d.sha256}</p>
              {d.decisionReason && <p className="break-words">Reason given to the applicant: {d.decisionReason}</p>}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void api.download(`${base}/documents/${d.id}/file`, d.filename).catch((e: Error) => setError(e.message))}
              >
                Download {d.filename}
              </Button>
              {d.status === 'pending' && (
                <div className="space-y-2">
                  <Label htmlFor={`reason-${d.id}`}>Reason (visible to the applicant; required to reject)</Label>
                  <Textarea
                    id={`reason-${d.id}`}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReasons({ ...reasons, [d.id]: e.target.value })}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={decide.isPending || (reason.trim().length > 0 && reason.trim().length < 10)}
                      onClick={() => { setError(''); decide.mutate({ id: d.id, status: 'verified', reason: reason.trim() || undefined }); }}
                    >
                      Verify {d.filename}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={decide.isPending || reason.trim().length < 10}
                      onClick={() => { setError(''); decide.mutate({ id: d.id, status: 'rejected', reason: reason.trim() }); }}
                    >
                      Reject {d.filename}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
