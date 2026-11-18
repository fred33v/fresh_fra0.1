import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type Application = {
  id: string; applicantName: string; applicantEmail: string; companyName: string;
  serviceInterest: 'sales' | 'training' | 'both'; trainingExperience: string | null;
  status: string; revision: number; reviewReason: string | null;
  qualificationEvidence: string | null; agreementDocumentId: string | null;
};
const endpoint = '/api/v1/provider-applications';

export default function ProviderReview() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ['provider-review', user?.userId, user?.organisationId, page],
    queryFn: () => api.get<Application[]>(`${endpoint}/review?page=${page}`), retry: false });
  return <Layout><main className="container max-w-3xl space-y-6 py-10">
    <h1 className="text-2xl font-bold">Provider recruitment review</h1>
    <p>Review experience and qualifications, complete the provider agreement through Electronic signing,
      then record the completed document reference below. Approval does not create an employment contract or trigger payment.</p>
    {query.isPending && <p role="status">Loading applications…</p>}
    {query.isError && <p role="alert">{query.error.message}</p>}
    <Button variant="outline" onClick={() => void query.refetch()}>Refresh applications</Button>
    {query.isSuccess && query.data.length === 0 && <p>No applications yet.</p>}
    <div className="flex gap-3">
      <Button variant="outline" disabled={page === 0 || query.isPending} onClick={() => setPage(p => p - 1)}>Previous page</Button>
      <Button variant="outline" disabled={query.isPending || query.data?.length !== 50} onClick={() => setPage(p => p + 1)}>Next page</Button>
    </div>
    {query.data?.map(a => <Review key={`${a.id}-${a.revision}`} application={a} />)}
  </main></Layout>;
}

function Review({ application: a }: { application: Application }) {
  const client = useQueryClient();
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState(a.qualificationEvidence ?? '');
  const [agreement, setAgreement] = useState(a.agreementDocumentId ?? '');
  const [status, setStatus] = useState(a.status === 'approved' ? 'suspended' : 'approved');
  const [packageId, setPackageId] = useState('pkg_basic');
  const [reference, setReference] = useState('');
  const [service, setService] = useState(a.serviceInterest === 'training' ? 'training' : 'sales');
  const packages = useQuery({ queryKey: ['provider-package-catalog'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/api/v1/packages') });
  const mutation = useMutation({ mutationFn: () => api.post(`${endpoint}/${a.id}/review`, {
    revision: a.revision, status, reason,
    qualificationEvidence: status === 'approved' && a.serviceInterest !== 'sales' ? evidence : undefined,
    agreementDocumentId: status === 'approved' ? agreement : undefined,
  }), onSuccess: () => client.invalidateQueries({ queryKey: ['provider-review'] }) });
  const assignment = useMutation({ mutationFn: () => api.post(`${endpoint}/${a.id}/assignments`, { packageId, reference, service }),
    onSuccess: async () => { setReference(''); await client.invalidateQueries({queryKey:['provider-review-assignments',a.id]}); await client.invalidateQueries({queryKey:['provider-audit',a.id]}); } });
  const offers = useQuery({ queryKey: ['provider-review-assignments', a.id],
    queryFn: () => api.get<{id:string;reference:string;status:string}[]>(`${endpoint}/${a.id}/assignments`) });
  const close = useMutation({ mutationFn: ({id, status}: {id:string;status:string}) => api.post(`${endpoint}/${a.id}/assignments/${id}/close`, {status,reason}),
    onSuccess: async () => { await client.invalidateQueries({queryKey:['provider-review-assignments',a.id]}); await client.invalidateQueries({queryKey:['provider-audit',a.id]}); } });
  const audit = useQuery({ queryKey: ['provider-audit', a.id, a.revision],
    queryFn: () => api.get<{ event: string; occurredAt: string }[]>(`${endpoint}/${a.id}/audit`) });
  function submit(e: FormEvent) { e.preventDefault(); mutation.mutate(); }
  return <section className="space-y-4 rounded-md border p-5" aria-label={`Application from ${a.applicantName}`}>
    <h2 className="text-xl font-semibold">{a.applicantName} — {a.companyName}</h2>
    <p>{a.applicantEmail} · {a.serviceInterest} · {a.status}</p>
    {a.trainingExperience && <p className="whitespace-pre-wrap">Training experience: {a.trainingExperience}</p>}
    {a.reviewReason && <p>Last decision: {a.reviewReason}</p>}
    {a.status !== 'declined' && <form onSubmit={submit} className="space-y-3">
      <Label htmlFor={`${a.id}-decision`}>Decision</Label>
      <select id={`${a.id}-decision`} value={status} onChange={e => setStatus(e.target.value)} className="block w-full rounded border bg-background p-2">
        {a.status !== 'approved' && <option value="approved">Approve</option>}
        {a.status === 'submitted' && <option value="declined">Decline</option>}
        {a.status === 'approved' && <option value="suspended">Suspend access</option>}
      </select>
      <Label htmlFor={`${a.id}-reason`}>Decision reason (visible to applicant)</Label>
      <Textarea id={`${a.id}-reason`} required minLength={10} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} />
      {status === 'approved' && <>
        <Label htmlFor={`${a.id}-agreement`}>Completed signing document UUID</Label>
        <Input id={`${a.id}-agreement`} required value={agreement} onChange={e => setAgreement(e.target.value)} />
        {a.serviceInterest !== 'sales' && <>
          <Label htmlFor={`${a.id}-evidence`}>Qualification verification and training demonstration evidence</Label>
          <Textarea id={`${a.id}-evidence`} required minLength={10} maxLength={4000} value={evidence} onChange={e => setEvidence(e.target.value)} />
        </>}
      </>}
      {mutation.isError && <p role="alert">{mutation.error.message}</p>}
      <Button disabled={mutation.isPending}>Save review decision</Button>
    </form>}
    {a.status === 'approved' && <form className="space-y-3" onSubmit={e => { e.preventDefault(); assignment.mutate(); }}>
      <h3 className="font-semibold">Offer a package assignment</h3>
      <Label htmlFor={`${a.id}-package`}>Package</Label>
      <select id={`${a.id}-package`} value={packageId} onChange={e => setPackageId(e.target.value)} className="block w-full rounded border bg-background p-2">
        {packages.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <Label htmlFor={`${a.id}-service`}>Service</Label>
      <select id={`${a.id}-service`} value={service} onChange={e => setService(e.target.value)} className="block w-full rounded border bg-background p-2">
        {a.serviceInterest !== 'training' && <option value="sales">Sales</option>}
        {a.serviceInterest !== 'sales' && <option value="training">Training</option>}
      </select>
      <Label htmlFor={`${a.id}-reference`}>Unique work reference</Label>
      <Input id={`${a.id}-reference`} required minLength={2} maxLength={160} value={reference} onChange={e => setReference(e.target.value)} />
      {assignment.isError && <p role="alert">{assignment.error.message}</p>}
      {assignment.isSuccess && <p role="status">Assignment offered.</p>}
      <Button disabled={assignment.isPending || !packages.data?.length}>Offer assignment</Button>
    </form>}
    {offers.isError && <p role="alert">Could not load assignments.</p>}
    {close.isError && <p role="alert">{close.error.message}</p>}
    <h3 className="font-semibold">Assignments</h3>
    <p>Enter a decision reason above before cancelling or completing work. Completing work does not confirm a customer payment.</p>
    {offers.data?.map(o => <div key={o.id} className="space-y-2 border p-2"><p>{o.reference}: {o.status}</p>
      {['offered','accepted'].includes(o.status) && <Button variant="outline" disabled={reason.trim().length < 10 || close.isPending} onClick={() => close.mutate({id:o.id,status:'cancelled'})}>Cancel {o.reference}</Button>}
      {o.status === 'accepted' && a.status === 'approved' && <Button disabled={reason.trim().length < 10 || close.isPending} onClick={() => close.mutate({id:o.id,status:'completed'})}>Complete {o.reference}</Button>}
    </div>)}
    {audit.isError && <p role="alert">Could not load the decision history.</p>}
    <details><summary>Decision history</summary><ul>{audit.data?.map((e, i) => <li key={i}>{e.occurredAt}: {e.event}</li>)}</ul></details>
  </section>;
}
