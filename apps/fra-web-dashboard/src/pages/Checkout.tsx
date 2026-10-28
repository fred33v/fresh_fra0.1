import { useState, type ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layout } from '@/components/layout/Layout';
import {
  Shield,
  CreditCard,
  CheckCircle2,
  Lock,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { getPackage } from '@/data/packages';

export default function Checkout() {
  const [searchParams] = useSearchParams();

  // Price always comes from the catalogue, never the URL. "Health-Check" is the
  // Starter package's old name, kept so existing links still work.
  const rawPackageName = searchParams.get('package');
  const selectedPackage = getPackage(rawPackageName === 'Health-Check' ? 'Starter' : rawPackageName ?? '');
  const price = selectedPackage?.priceGbp ?? 0;

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<ReactNode | null>(null);
  const cancelled = searchParams.get('cancelled') === '1';

  const packageName = selectedPackage?.name ?? null;

  if (!selectedPackage || !packageName) {
    return <Navigate to="/" replace />;
  }

  const vat = price * 0.20;
  const total = price * 1.20;

  // Card details are entered on Stripe's hosted page, never here
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setPaymentError(null);
    setIsProcessing(true);
    try {
      const purchase = await api.post<{
        purchaseId: string;
        checkoutUrl: string | null;
        simulated?: boolean;
        paymentIntentId?: string;
      }>('/api/v1/purchases', { packageId: selectedPackage.id, client: 'web' });

      if (purchase.checkoutUrl) {
        window.location.assign(purchase.checkoutUrl);
        return; // stay "processing" while the browser leaves for Stripe
      }

      // Local development without Stripe keys: the server simulates the payment
      await api.post(`/api/v1/purchases/${purchase.purchaseId}/confirm`, { paymentIntentId: purchase.paymentIntentId });
      setIsSuccess(true);
      setIsProcessing(false);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      if (code === 'DUPLICATE_PURCHASE') {
        setPaymentError('You already have an active subscription for this package.');
      } else if (code === 'UNAUTHORIZED') {
        setPaymentError(
          <>Sign in or create your organisation account to continue. <Link className="underline font-medium" to={`/auth?package=${encodeURIComponent(packageName)}`}>Sign in</Link></>,
        );
      } else if (code === 'PAYMENTS_UNAVAILABLE' || code === 'PAYMENT_PROVIDER_ERROR') {
        setPaymentError('The secure payment page could not be opened. Please try again in a few minutes.');
      } else {
        setPaymentError('Something went wrong starting your payment. Please try again.');
      }
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <Layout>
        <section className="py-20 lg:py-32">
          <div className="container max-w-lg">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="border-0 shadow-xl text-center">
                <CardContent className="pt-12 pb-10 px-8">
                  <div className="flex justify-center mb-6">
                    <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                  </div>

                  <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
                  <p className="text-muted-foreground mb-8">
                    Your {packageName} package is now active.
                  </p>

                  <div className="rounded-lg bg-muted/50 p-4 mb-8 text-left space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Package</span>
                      <span className="font-medium">{packageName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">
                        {'\u00A3'}{total.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium text-green-600 dark:text-green-400">Confirmed</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Every package starts with the risk assessment (package 1), whichever was bought */}
                    <Button className="w-full" asChild>
                      <Link to="/assessment">Start Your Risk Assessment</Link>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/dashboard">Go to Dashboard</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-12 lg:py-20">
        <div className="container max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8 space-y-4"
          >
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link to="/#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium" aria-current="page">Checkout</span>
            </nav>

            <div className="flex items-center gap-2 text-sm" aria-label="Checkout steps">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                Select Package
              </span>
              <div className="h-px w-6 bg-border" />
              <span className="flex items-center gap-1.5 font-medium text-primary">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
                Payment
              </span>
              <div className="h-px w-6 bg-border" />
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">3</span>
                Confirmation
              </span>
            </div>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card className="border-0 shadow-xl gradient-hero text-primary-foreground">
                <CardHeader>
                  <CardTitle className="text-xl">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold mb-1">{packageName}</h3>
                    <p className="text-primary-foreground/70 text-sm">
                      {packageName === 'Professional'
                        ? 'FRA + Training - Annual Subscription'
                        : packageName === 'Enterprise'
                        ? 'Full Dashboard - Annual Subscription'
                        : 'Fraud Risk Health Check - One-Time'}
                    </p>
                  </div>

                  <div className="space-y-3 border-t border-primary-foreground/20 pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-primary-foreground/70">Subtotal</span>
                      <span>{'\u00A3'}{price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-primary-foreground/70">VAT (20%)</span>
                      <span>{'\u00A3'}{vat.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t border-primary-foreground/20 pt-3">
                      <span>Total</span>
                      <span>{'\u00A3'}{total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-4 py-1.5 text-xs font-semibold text-primary-foreground/90 backdrop-blur">
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Built for GovS 013 & ECCTA 2023</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Payment Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-xl">Payment Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePayment} className="space-y-4" noValidate>
                    {cancelled && !paymentError && (
                      <div role="status" className="rounded-md border bg-muted/50 p-3 text-sm">
                        Payment was cancelled and you have not been charged. You can try again when you are ready.
                      </div>
                    )}
                    {paymentError && (
                      <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{paymentError}</span>
                      </div>
                    )}

                    <div className="flex items-start gap-3 rounded-md border p-4 text-sm">
                      <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
                      <div className="space-y-1">
                        <p className="font-medium">Pay by card on Stripe's secure page</p>
                        <p className="text-muted-foreground">
                          You will enter your card details with Stripe, our payment provider, then come back here.
                          We never see or store your card number. You will get a receipt by email.
                        </p>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={isProcessing}>
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          Opening secure payment…
                        </>
                      ) : `Continue to payment \u00B7 \u00A3${total.toFixed(2)}`}
                    </Button>

                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Payments processed securely by Stripe</span>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      By continuing you agree to the <Link to="/terms" className="underline">terms of service</Link>, including
                      the terms on payment and cancellation.
                    </p>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
