import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import ServiceDeliveries from '@/components/delivery/ServiceDeliveries';
export default function ServiceDelivery() {
  const { user } = useAuth();
  const [review, setReview] = useState(false);
  return (
    <Layout>
      <main className="container max-w-5xl space-y-5 py-10">
        <h1 className="text-2xl font-bold">Service delivery portal</h1>
        <p>
          Review your service history, training attendance, retained evidence and customer
          decisions.
        </p>
        {user?.role === 'admin' && (
          <label className="flex gap-2">
            <input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} />
            Operator review view (authorisation checked by server)
          </label>
        )}
        <ServiceDeliveries key={String(review)} review={review} />
      </main>
    </Layout>
  );
}
