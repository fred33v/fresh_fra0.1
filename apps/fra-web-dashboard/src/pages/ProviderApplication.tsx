import { ProviderStatement } from '@/components/ProviderStatement';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const endpoint = '/api/v1/provider-applications/me';

type ServiceInterest = 'sales' | 'training' | 'both';
type Application = {
  companyName: string;
  providerCode: string | null;
  reviewReason: string | null;
  status: 'submitted' | 'approved' | 'declined' | 'suspended';
};

const statuses = { submitted: 'Awaiting review', approved: 'Approved', declined: 'Declined', suspended: 'Suspended' };

export default function ProviderApplication() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['provider-application', user?.userId, user?.organisationId];
  const [companyName, setCompanyName] = useState('');
  const [serviceInterest, setServiceInterest] = useState<ServiceInterest>('sales');
  const [trainingExperience, setTrainingExperience] = useState('');
  const application = useQuery({
    queryKey,
    queryFn: () => api.get<Application | null>(endpoint),
    retry: false,
  });
  const submission = useMutation({
    mutationFn: () =>
      api.post<Application>(endpoint, {
        companyName,
        serviceInterest,
        trainingExperience: serviceInterest === 'sales' ? undefined : trainingExperience,
      }),
    onSuccess: (saved) => queryClient.setQueryData(queryKey, saved),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submission.mutate();
  }

  return (
    <Layout>
      <main className="container max-w-2xl space-y-6 py-10">
        <h1 className="text-2xl font-bold">Apply to become a provider</h1>
        <p>
          Apply to sell packages or deliver training while working at your company. The referral
          commission rate is 17% of the VAT-exclusive value of eligible paid package sales you bring.
          Applying does not start employment, grant customer access or trigger commission payments.
        </p>
        {user?.role === 'admin' && <Link className="underline" to="/provider-review">Review provider applications</Link>}
        {application.isPending && <p role="status">Loading your application…</p>}
        {application.isError && (
          <div className="space-y-3">
            <p role="alert">{application.error.message}</p>
            <Button variant="outline" onClick={() => void application.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {application.data && (
          <p role="status">
            Application for {application.data.companyName} — {statuses[application.data.status]}
          </p>
        )}
        {application.data?.reviewReason && <p>Review decision: {application.data.reviewReason}</p>}
        {application.data && <ProviderStatement />}
        {application.data?.status === 'approved' && <>
          <p>Your provider reference: <strong>{application.data.providerCode}</strong>. This reference identifies you; it is not a login or customer access code.</p>
          <Assignments providerCode={application.data.providerCode ?? ''} />
        </>}
        {application.isSuccess && application.data === null && (
          <form className="space-y-4" onSubmit={submit}>
            <p>We use the name and verified email address from your account.</p>
            <div className="space-y-2">
              <Label htmlFor="provider-company">Company name</Label>
              <Input
                id="provider-company"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                required
                minLength={2}
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-interest">I want to</Label>
              <select
                id="provider-interest"
                className="block w-full rounded-md border bg-background px-3 py-2"
                value={serviceInterest}
                onChange={(event) => setServiceInterest(event.target.value as ServiceInterest)}
              >
                <option value="sales">Sell packages</option>
                <option value="training">Deliver training</option>
                <option value="both">Sell packages and deliver training</option>
              </select>
            </div>
            {serviceInterest !== 'sales' && (
              <div className="space-y-2">
                <Label htmlFor="provider-training">Training experience and qualifications</Label>
                <Textarea
                  id="provider-training"
                  value={trainingExperience}
                  onChange={(event) => setTrainingExperience(event.target.value)}
                  required
                  minLength={10}
                  maxLength={4000}
                />
              </div>
            )}
            {submission.isError && <p role="alert">{submission.error.message}</p>}
            <Button type="submit" disabled={submission.isPending}>
              {submission.isPending ? 'Submitting…' : 'Submit application'}
            </Button>
          </form>
        )}
      </main>
    </Layout>
  );
}


type Assignment = { id: string; packageName: string; reference: string; service: string; status: string };
function Assignments({ providerCode }: { providerCode: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['provider-assignments', user?.userId, user?.organisationId],
    queryFn: () => api.get<Assignment[]>(`${endpoint}/assignments`) });
  const decision = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) =>
    api.post(`${endpoint}/assignments/${id}/decision`, { status }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['provider-assignments'] }) });
  return <section className="space-y-3"><h2 className="text-xl font-semibold">Your package assignments</h2>
    {query.isPending && <p role="status">Loading assignments…</p>}
    {query.isError && <p role="alert">{query.error.message}</p>}
    {query.data?.length === 0 && <p>No package assignments yet.</p>}
    {decision.isError && <p role="alert">{decision.error.message}</p>}
    {query.data?.map(a => <article key={a.id} className="space-y-2 rounded border p-3">
      <h3>{a.packageName} — {a.service}</h3><p>{a.reference}: {a.status}</p>
      {a.service === 'sales' && ['accepted','completed'].includes(a.status) && <Link className="underline" to={`/checkout?package=${encodeURIComponent(a.packageName)}&provider=${encodeURIComponent(providerCode)}`}>Open referral checkout for {a.packageName}</Link>}
      {a.status === 'offered' && <div className="flex gap-3">
        <Button disabled={decision.isPending} onClick={() => decision.mutate({ id: a.id, status: 'accepted' })}>Accept {a.reference}</Button>
        <Button variant="outline" disabled={decision.isPending} onClick={() => decision.mutate({ id: a.id, status: 'refused' })}>Refuse {a.reference}</Button>
      </div>}
    </article>)}
  </section>;
}
