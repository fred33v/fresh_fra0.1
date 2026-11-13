import { useEffect, useState, type ReactElement } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, AlertCircle, Loader2, Smartphone } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Layout } from '@/components/layout/Layout';

type State = 'checking' | 'paid' | 'pending' | 'failed' | 'signed_out' | 'mobile';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Stripe can return the buyer a moment before the payment settles, so look again a few times. */
const RETRIES = 5;
const RETRY_MS = 2000;

/** The app's own address; fixed here, never taken from the URL, so this page cannot be used to redirect elsewhere. */
export const MOBILE_RETURN_URL = 'fra-mobile://payment-complete';

/** Where Stripe sends buyers after paying. The server checks with Stripe before the package is switched on. */
export default function CheckoutComplete() {
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get('purchase') ?? '';
  const fromMobile = searchParams.get('client') === 'mobile';
  const cancelled = searchParams.get('cancelled') === '1';
  const appUrl = `${MOBILE_RETURN_URL}${cancelled ? '?cancelled=1' : ''}`;
  const [state, setState] = useState<State>(fromMobile ? 'mobile' : UUID.test(purchaseId) ? 'checking' : 'failed');

  // Hand mobile buyers straight back to the app, which closes this browser and confirms the purchase itself
  useEffect(() => {
    if (fromMobile) window.location.assign(appUrl);
  }, [fromMobile, appUrl]);

  useEffect(() => {
    if (fromMobile || !UUID.test(purchaseId)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const check = async (attempt: number) => {
      try {
        await api.post(`/api/v1/purchases/${purchaseId}/confirm`, {});
        if (!cancelled) setState('paid');
      } catch (err) {
        if (cancelled) return;
        const code = err instanceof ApiError ? err.code : '';
        if (code === 'PAYMENT_PENDING' && attempt < RETRIES) {
          timer = setTimeout(() => check(attempt + 1), RETRY_MS);
        } else if (code === 'PAYMENT_PENDING') {
          setState('pending');
        } else if (code === 'UNAUTHORIZED') {
          setState('signed_out');
        } else {
          setState('failed');
        }
      }
    };
    check(1);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [purchaseId, fromMobile]);

  const content: Record<State, { icon: ReactElement; title: string; body: string; actions: ReactElement }> = {
    checking: {
      icon: <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />,
      title: 'Confirming your payment…',
      body: 'This usually takes a few seconds.',
      actions: <></>,
    },
    paid: {
      icon: <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />,
      title: 'Payment successful',
      body: 'Your package is now active. A receipt is on its way to your email.',
      actions: <Button className="w-full" asChild><Link to="/dashboard">Go to dashboard</Link></Button>,
    },
    pending: {
      icon: <Clock className="h-8 w-8 text-amber-600" aria-hidden="true" />,
      title: 'Payment is still processing',
      body: 'Stripe has not confirmed the payment yet. Your package will switch on automatically when it does; you do not need to pay again.',
      actions: <Button className="w-full" asChild><Link to="/dashboard">Go to dashboard</Link></Button>,
    },
    signed_out: {
      icon: <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />,
      title: 'Thank you',
      body: 'Sign in to see your package. If your payment went through, it switches on automatically.',
      actions: <Button className="w-full" asChild><Link to="/auth">Sign in</Link></Button>,
    },
    failed: {
      icon: <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />,
      title: 'Payment not completed',
      body: 'We could not confirm a payment for this order, and you have not been charged for it. You can start again from the pricing page.',
      actions: <Button className="w-full" asChild><Link to="/#pricing">Back to pricing</Link></Button>,
    },
    mobile: {
      icon: <Smartphone className="h-8 w-8 text-primary" aria-hidden="true" />,
      title: cancelled ? 'Payment cancelled' : 'Payment complete',
      body: cancelled
        ? 'You have not been charged. Return to the FRAUD-RISK.CO.UK app to try again.'
        : 'Return to the FRAUD-RISK.CO.UK app to continue.',
      actions: <Button className="w-full" asChild><a href={appUrl}>Return to the app</a></Button>,
    },
  };
  const view = content[state];

  return (
    <Layout>
      <section className="py-20 lg:py-32">
        <div className="container max-w-lg">
          <Card className="border-0 shadow-xl text-center">
            <CardContent className="pt-12 pb-10 px-8 space-y-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">{view.icon}</div>
              </div>
              <div role={state === 'checking' ? 'status' : undefined} aria-live="polite">
                <h1 className="text-2xl font-bold mb-2">{view.title}</h1>
                <p className="text-muted-foreground">{view.body}</p>
              </div>
              {view.actions}
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}
