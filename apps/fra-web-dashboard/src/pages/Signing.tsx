import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import {
  signingPath,
  signingTimestamp,
  signingStatusLabels,
  validateLayout,
  type DocumentSummary,
  type SigningDocument,
  type SigningField,
  type SigningStatus,
} from '@/lib/esign';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/hooks/useConfirm';
const PdfFieldEditor = lazy(() => import('@/components/esign/PdfFieldEditor'));
const steps = ['Document', 'Recipients', 'Fields', 'Review & send'];
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
function Status({ status }: { status: SigningStatus }) {
  return (
    <Badge
      variant="outline"
      className={
        status === 'completed'
          ? 'border-teal-300 bg-teal-50 text-teal-900'
          : status === 'declined'
            ? 'border-red-200 bg-red-50 text-red-900'
            : status === 'sent'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'bg-muted text-muted-foreground'
      }
    >
      {signingStatusLabels[status]}
    </Badge>
  );
}
function Loading() {
  return (
    <div role="status" className="flex items-center gap-2 py-12 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> Loading documents…
    </div>
  );
}
function Failure({ error }: { error: unknown }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
    >
      {error instanceof Error
        ? error.message
        : 'This action could not be completed. Please try again.'}
    </div>
  );
}
export default function Signing() {
  const { id } = useParams();
  const { user } = useAuth();
  const scope = user?.userId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const isNew = id === 'new';
  const [offset, setOffset] = useState(0);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [fields, setFields] = useState<SigningField[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [reviewed, setReviewed] = useState(false);
  const [audit, setAudit] = useState<{
    entries: { seq: number; event: string; occurred_at: string }[];
    retainedCheckpointVerified: boolean;
  } | null>(null);
  const list = useQuery({
    queryKey: ['signing-documents', scope, offset],
    queryFn: () =>
      api.get<{ documents: DocumentSummary[]; hasMore: boolean }>(
        `/api/v1/esign/documents?offset=${offset}`
      ),
    enabled: !!scope && !id,
  });
  const detail = useQuery({
    queryKey: ['signing-document', scope, id],
    queryFn: () => api.get<SigningDocument>(signingPath(id!)),
    enabled: !!scope && !!id && !isNew,
    refetchInterval: (query) => (query.state.data?.status === 'sent' ? 10000 : false),
  });
  const doc = detail.data;
  const source = useQuery({
    queryKey: ['signing-source', scope, id],
    queryFn: () => api.blob(`${signingPath(id!)}/source`),
    enabled: !!doc && doc.status === 'draft' && step === 2,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    setError(null);
    setNotice('');
    setAudit(null);
    setReviewed(false);
    setFields([]);
    setName('');
    setEmail('');
    setStep(id && !isNew ? 1 : 0);
  }, [id, isNew]);
  useEffect(() => {
    if (doc)
      setFields(
        doc.fields.map((f) => ({
          signerId: f.signer_id,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          kind: f.kind,
        }))
      );
  }, [doc]);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['signing-documents', scope] }),
      queryClient.invalidateQueries({ queryKey: ['signing-document', scope, id] }),
    ]);
  };
  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await operation();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const ready = doc ? validateLayout(fields, doc.signers, doc.pages) : null;
  const upload = () =>
    run(async () => {
      if (!file || file.type !== 'application/pdf' || file.size > 1_000_000 || !title.trim())
        throw new Error('Choose a PDF up to 1 MB and enter its title.');
      const body = new FormData();
      body.set('file', file);
      body.set('title', title.trim());
      const created = await api.upload<{ id: string }>('/api/v1/esign/documents', body);
      await queryClient.invalidateQueries({ queryKey: ['signing-documents', scope] });
      setFile(null);
      setTitle('');
      navigate(`/signing/${created.id}`);
    });
  const addSigner = () =>
    run(async () => {
      await api.post(`${signingPath(id!)}/signers`, { name: name.trim(), email: email.trim() });
      setName('');
      setEmail('');
      await refresh();
      setNotice('Recipient added.');
    });
  const saveFields = () =>
    run(async () => {
      if (ready) throw new Error(ready);
      await api.put(`${signingPath(id!)}/fields`, { fields });
      await refresh();
      setStep(3);
      setReviewed(false);
    });
  const send = () =>
    run(async () => {
      if (!doc || !reviewed) return;
      if (
        !(await confirm({
          title: 'Send signing invitations?',
          description: `${doc.signers.length} recipient(s) will receive an email. The document, recipients and fields will be locked after sending.`,
          confirmLabel: 'Send invitations',
        }))
      )
        return;
      const result = await api.post<{ deliveries: { signerId: string; sent: boolean }[] }>(
        `${signingPath(id!)}/send`,
        {}
      );
      await refresh();
      const failed = result.deliveries.filter((d) => !d.sent).length;
      setNotice(
        failed
          ? `Document locked. ${failed} invitation(s) could not be sent. Use Resend invitation beside the recipient to retry.`
          : 'Invitations sent. You can track each recipient below.'
      );
    });
  const download = (kind: 'source' | 'final' | 'evidence') =>
    run(() =>
      api.download(
        `${signingPath(id!)}/${kind}`,
        kind === 'evidence'
          ? 'signing-evidence.json'
          : kind === 'final'
            ? 'signed-document.pdf'
            : 'document-to-review.pdf'
      )
    );
  const rows = list.data?.documents ?? [];
  const shown = rows.filter((d) => filter === 'all' || d.status === filter);
  return (
    <Layout>
      <div className="container max-w-7xl py-8 sm:py-12">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              to="/employer"
              className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Organisation
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileSignature className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Documents to sign
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prepare, send and follow every signature in one place.
                </p>
              </div>
            </div>
          </div>
          {!id && (
            <Button asChild className="gap-2">
              <Link to="/signing/new">
                <Plus className="h-4 w-4" /> New document
              </Link>
            </Button>
          )}
          {id && (
            <Button variant="outline" asChild>
              <Link to="/signing">All documents</Link>
            </Button>
          )}
        </div>
        {doc?.providerAgreement && (
          <div className="mb-5 rounded-lg border bg-muted/30 p-4 text-sm">
            <p>
              This agreement is linked to a candidate revision. Its terms and two signatories are
              fixed. Return to the application to prepare a retained replacement or complete
              administrative follow-up.
            </p>
            {user?.role === 'admin' && (
              <Link
                className="mt-2 inline-block font-medium text-primary underline"
                to={`/partners/review/${doc.providerAgreement.applicationId}`}
              >
                Return to candidate follow-up
              </Link>
            )}
          </div>
        )}
        {error != null && (
          <div className="mb-5">
            <Failure error={error} />
          </div>
        )}
        {notice && (
          <p
            role="status"
            className="mb-5 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950"
          >
            {notice}
          </p>
        )}
        {!id ? (
          <>
            <div className="mb-7 rounded-xl bg-slate-950 p-6 text-white sm:p-8">
              <div className="max-w-2xl">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
                  Electronic signatures
                </p>
                <h2 className="text-xl font-medium sm:text-2xl">
                  Less chasing. A clear record of every decision.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Recipients review your document, verify their email and sign online. Completed
                  documents include a platform seal and a retained evidence record.
                </p>
              </div>
            </div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Your organisation’s documents</h2>
                <p className="text-sm text-muted-foreground">
                  Showing up to 25 documents per page.
                </p>
              </div>
              <div className="flex gap-2">
                <Label htmlFor="document-status" className="sr-only">
                  Filter this page by status
                </Label>
                <select
                  id="document-status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="all">All statuses</option>
                  {Object.entries(signingStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Refresh documents"
                  disabled={list.isFetching}
                  onClick={() => void list.refetch()}
                >
                  <RefreshCw className={`h-4 w-4 ${list.isFetching ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            {list.isPending ? (
              <Loading />
            ) : list.isError ? (
              <Failure error={list.error} />
            ) : rows.length === 0 ? (
              <div className="rounded-xl border border-dashed px-6 py-16 text-center">
                <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Your first signature starts here</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Upload a PDF, choose who needs to sign, and place their signature fields.
                </p>
                <Button asChild className="mt-5">
                  <Link to="/signing/new">Prepare a document</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="p-4 font-medium">Document</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium">Signatures</th>
                      <th className="p-4 font-medium">Created</th>
                      <th className="p-4">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((d) => (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-4">
                          <Link to={`/signing/${d.id}`} className="font-medium hover:underline">
                            {d.title}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {d.status === 'sent' && d.expires_at
                              ? `Link expires ${date(d.expires_at)}`
                              : 'PDF document'}
                          </p>
                        </td>
                        <td className="p-4">
                          <Status status={d.status} />
                        </td>
                        <td className="p-4">
                          {d.signed_count} of {d.signer_count}
                        </td>
                        <td className="whitespace-nowrap p-4 text-muted-foreground">
                          {date(d.created_at)}
                        </td>
                        <td className="p-4">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/signing/${d.id}`} aria-label={`Open ${d.title}`}>
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {shown.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No documents with this status on this page.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={offset === 0 || list.isFetching}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!list.data?.hasMore || list.isFetching}
                onClick={() => setOffset(offset + 25)}
              >
                Next
              </Button>
            </div>
          </>
        ) : isNew || doc?.status === 'draft' ? (
          <>
            <nav aria-label="Document preparation" className="mb-7">
              <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {steps.map((label, index) => (
                  <li key={label}>
                    <button
                      type="button"
                      disabled={
                        isNew ||
                        index === 0 ||
                        busy ||
                        (index >= 2 && !doc?.signers.length) ||
                        (index === 3 && step !== 3)
                      }
                      aria-current={step === index ? 'step' : undefined}
                      onClick={() => {
                        setStep(index);
                        setError(null);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm disabled:cursor-default ${step === index ? 'border-primary bg-primary/5 font-semibold text-primary' : 'text-muted-foreground'}`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${step > index ? 'bg-teal-100 text-teal-900' : 'bg-muted'}`}
                      >
                        {step > index ? <Check className="h-3 w-3" /> : index + 1}
                      </span>
                      {label}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <section className="rounded-xl border bg-card p-5 sm:p-8" aria-busy={busy}>
              <fieldset disabled={busy} className="min-w-0">
                {step === 0 && (
                  <form
                    className="mx-auto max-w-xl space-y-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void upload();
                    }}
                  >
                    <div>
                      <h2 className="text-xl font-semibold">Start with your document</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Choose a PDF to send for signature. You will review it before any
                        invitations are sent.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="document-title">Document title</Label>
                      <Input
                        id="document-title"
                        className="mt-2"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={160}
                        placeholder="e.g. Supplier agreement"
                        required
                        disabled={busy}
                      />
                    </div>
                    <div className="rounded-xl border-2 border-dashed bg-muted/20 p-6">
                      <UploadCloud className="mb-3 h-8 w-8 text-primary" />
                      <Label htmlFor="document-file" className="block font-semibold">
                        Choose your PDF
                      </Label>
                      <p id="pdf-help" className="my-2 text-sm text-muted-foreground">
                        PDF only, up to 1 MB. Password-protected PDFs are not supported.
                      </p>
                      <Input
                        id="document-file"
                        className="bg-background"
                        type="file"
                        accept="application/pdf,.pdf"
                        aria-describedby="pdf-help"
                        required
                        disabled={busy}
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <Button className="w-full" disabled={busy || !file || !title.trim()}>
                      {busy ? 'Uploading…' : 'Upload & continue'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                )}
                {step === 1 && doc && (
                  <div className="mx-auto max-w-2xl">
                    <h2 className="text-xl font-semibold">Who needs to sign?</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Add up to 20 recipients. Each person receives a private invitation and
                      verifies their email.
                    </p>
                    <div className="my-5 rounded-lg border bg-muted/20 p-4">
                      <p className="font-medium">{doc.title}</p>
                      <Button
                        variant="link"
                        className="h-auto p-0 text-sm"
                        disabled={busy}
                        onClick={() => void download('source')}
                      >
                        Download document to review
                      </Button>
                    </div>
                    <ul className="mb-6 space-y-2">
                      {doc.signers.map((s, i) => (
                        <li key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm text-primary">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium">{s.name}</p>
                            <p className="break-all text-sm text-muted-foreground">{s.email}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void addSigner();
                      }}
                      className="grid gap-4 rounded-lg bg-muted/30 p-4 sm:grid-cols-2"
                    >
                      <div>
                        <Label htmlFor="signer-name">Full name</Label>
                        <Input
                          id="signer-name"
                          className="mt-1"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          maxLength={120}
                          pattern="[\x20-\x7e\u00a0-\u00ff]+"
                          title="Use Latin characters for PDF signatures"
                          disabled={busy || !!doc.providerAgreement || doc.signers.length >= 20}
                        />
                      </div>
                      <div>
                        <Label htmlFor="signer-email">Email address</Label>
                        <Input
                          id="signer-email"
                          className="mt-1"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          maxLength={254}
                          disabled={busy || !!doc.providerAgreement || doc.signers.length >= 20}
                        />
                      </div>
                      <Button
                        variant="outline"
                        className="sm:col-span-2"
                        disabled={busy || !!doc.providerAgreement || doc.signers.length >= 20}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add recipient
                      </Button>
                    </form>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Recipient details cannot be changed in this draft. Check each address before
                      adding.
                    </p>
                    <div className="mt-6 flex justify-end">
                      <Button disabled={busy || !doc.signers.length} onClick={() => setStep(2)}>
                        Place signature fields
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {step === 2 && doc && (
                  <>
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold">Make room for every signature</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Select a recipient, then place their fields on the PDF. Every recipient
                        needs at least one signature field.
                      </p>
                    </div>
                    {source.isPending ? (
                      <Loading />
                    ) : source.isError ? (
                      <>
                        <Failure error={source.error} />
                        <Button
                          variant="outline"
                          className="mt-3"
                          onClick={() => void source.refetch()}
                        >
                          Retry preview
                        </Button>
                      </>
                    ) : (
                      source.data && (
                        <Suspense fallback={<Loading />}>
                          <PdfFieldEditor
                            pdf={source.data}
                            pages={doc.pages}
                            signers={doc.signers}
                            fields={fields}
                            onChange={setFields}
                          />
                        </Suspense>
                      )
                    )}
                    {ready && (
                      <p role="status" className="mt-5 text-sm text-amber-800">
                        {ready}
                      </p>
                    )}
                    <div className="mt-7 flex justify-between">
                      <Button variant="outline" disabled={busy} onClick={() => setStep(1)}>
                        Back
                      </Button>
                      <Button disabled={busy || !!ready} onClick={() => void saveFields()}>
                        {busy ? 'Saving…' : 'Save fields & review'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
                {step === 3 && doc && (
                  <div className="mx-auto max-w-2xl">
                    <h2 className="text-xl font-semibold">Ready to send?</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Check the document and recipients. Sending locks the document and its fields.
                    </p>
                    <div className="my-6 space-y-5 rounded-xl border p-5">
                      <div className="flex gap-3">
                        <FileText className="mt-1 h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.pages.length} page(s) · {fields.length} field(s)
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Users className="mt-1 h-5 w-5 text-primary" />
                        <div>
                          <p className="mb-2 font-semibold">{doc.signers.length} recipient(s)</p>
                          {doc.signers.map((s) => (
                            <p key={s.id} className="break-all text-sm">
                              {s.name} · {s.email}
                            </p>
                          ))}
                        </div>
                      </div>
                      <p className="border-t pt-4 text-sm text-muted-foreground">
                        Invitations expire after 7 days. Each recipient verifies their email,
                        reviews the PDF and explicitly consents before signing.
                      </p>
                    </div>
                    <label className="flex items-start gap-3 rounded-lg bg-muted/30 p-4 text-sm">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        disabled={busy}
                        onChange={(e) => setReviewed(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        I have checked the document, recipient addresses and field positions, and I
                        am ready to send the invitations.
                      </span>
                    </label>
                    <div className="mt-6 flex justify-between gap-3">
                      <Button variant="outline" disabled={busy} onClick={() => setStep(2)}>
                        Back to fields
                      </Button>
                      <Button disabled={busy || !reviewed || !!ready} onClick={() => void send()}>
                        <Mail className="mr-2 h-4 w-4" />
                        {busy ? 'Sending…' : 'Send invitations'}
                      </Button>
                    </div>
                  </div>
                )}
              </fieldset>
            </section>
          </>
        ) : detail.isPending ? (
          <Loading />
        ) : detail.isError ? (
          <Failure error={detail.error} />
        ) : (
          doc && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <section className="rounded-xl border bg-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="break-words text-xl font-semibold">{doc.title}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Created {date(doc.createdAt)} · {doc.pages.length} page(s)
                      </p>
                    </div>
                    <Status status={doc.status} />
                  </div>
                  <div className="mt-6 rounded-lg bg-muted/30 p-4">
                    <p className="font-medium">
                      {doc.status === 'completed'
                        ? 'All signatures collected'
                        : doc.status === 'declined'
                          ? 'A recipient declined this document'
                          : doc.signers.every((s) => s.status === 'signed')
                            ? 'All signed — final PDF sealing is pending'
                            : 'Waiting for recipients to review and sign'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {doc.signers.filter((s) => s.status === 'signed').length} of{' '}
                      {doc.signers.length} signed
                      {doc.status === 'sent' ? ` · Links expire ${date(doc.expiresAt)}` : ''}
                    </p>
                  </div>
                  <h3 className="mb-3 mt-6 font-semibold">Recipients</h3>
                  <ul className="divide-y">
                    {doc.signers.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{s.name}</p>
                          <p className="break-all text-sm text-muted-foreground">{s.email}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {s.status === 'signed'
                              ? `Signed ${date(s.signed_at)}`
                              : s.status === 'declined'
                                ? 'Declined'
                                : s.invitation_sent_at
                                  ? 'Invitation sent · Awaiting signature'
                                  : 'Invitation delivery needs attention'}
                          </p>
                        </div>
                        {s.status === 'pending' && doc.status === 'sent' && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              busy ||
                              (!!doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now())
                            }
                            onClick={() =>
                              void run(async () => {
                                if (
                                  !(await confirm({
                                    title: 'Resend invitation?',
                                    description:
                                      'The previous signing link will stop working. A new private link will be emailed to this recipient.',
                                    confirmLabel: 'Resend invitation',
                                  }))
                                )
                                  return;
                                await api.post(`${signingPath(id!)}/signers/${s.id}/resend`, {});
                                await refresh();
                                setNotice(
                                  'A new invitation has been sent. The previous link no longer works.'
                                );
                              })
                            }
                          >
                            Resend invitation
                          </Button>
                        )}
                        {s.status === 'signed' && (
                          <CheckCircle2 className="h-5 w-5 text-teal-700" aria-label="Signed" />
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
                {audit && (
                  <section className="rounded-xl border p-6">
                    <h3 className="font-semibold">Activity & evidence</h3>
                    <p role="status" className="my-3 text-sm text-teal-800">
                      {audit.retainedCheckpointVerified
                        ? 'Audit chain and retained evidence checkpoint verified.'
                        : 'Audit chain verified. The retained checkpoint becomes available after completion.'}
                    </p>
                    <ol className="space-y-3">
                      {audit.entries.map((entry) => (
                        <li key={entry.seq} className="border-l-2 border-teal-200 pl-4 text-sm">
                          <p className="font-medium">{entry.event.replace(/[._]/g, ' ')}</p>
                          <time className="text-xs text-muted-foreground">
                            {signingTimestamp(entry.occurred_at).toLocaleString('en-GB')}
                          </time>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </div>
              <aside className="space-y-5">
                <section className="space-y-3 rounded-xl border p-5">
                  <h3 className="font-semibold">Document actions</h3>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    disabled={busy}
                    onClick={() => void download('source')}
                  >
                    <Download className="mr-2 h-4 w-4" /> Prepared document
                  </Button>
                  {doc.status === 'completed' && (
                    <>
                      <Button
                        className="w-full justify-start"
                        disabled={busy}
                        onClick={() => void download('final')}
                      >
                        <Download className="mr-2 h-4 w-4" /> Signed PDF
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        disabled={busy}
                        onClick={() => void download('evidence')}
                      >
                        Download evidence
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => setAudit(await api.get(`${signingPath(id!)}/audit`)))
                    }
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" /> Verify activity record
                  </Button>
                  {doc.status === 'sent' && doc.signers.every((s) => s.status === 'signed') && (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await api.post(`${signingPath(id!)}/finalise`, {});
                          await refresh();
                          setNotice('Final PDF sealing retried.');
                        })
                      }
                    >
                      Retry PDF sealing
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled={busy}
                    onClick={() => void run(refresh)}
                  >
                    Refresh status
                  </Button>
                </section>
                <section className="rounded-xl bg-slate-950 p-5 text-sm text-slate-300">
                  <ShieldCheck className="mb-3 h-6 w-6 text-teal-300" />
                  <h3 className="mb-2 font-semibold text-white">A lasting record</h3>
                  <p className="leading-relaxed">
                    Completed documents are sealed and stored with retained signing evidence. This
                    is an electronic signature with a platform seal; it does not establish a
                    qualified signer identity.
                  </p>
                </section>
              </aside>
            </div>
          )
        )}
      </div>
    </Layout>
  );
}
