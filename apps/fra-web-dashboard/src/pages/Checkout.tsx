import { useState } from 'react';
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

export default function Checkout() {
  const [searchParams] = useSearchParams();

  const VALID_PACKAGES = ['Professional', 'Enterprise', 'Health-Check', 'Starter'] as const;

  const PACKAGE_ID_MAP: Record<string, string> = {
    Professional: 'pkg_training',
    Enterprise: 'pkg_full',
    'Health-Check': 'pkg_basic',
    Starter: 'pkg_basic',
  };

  const rawPackageName = searchParams.get('package');
  const priceParam = searchParams.get('price');
  const parsedPrice = priceParam ? parseFloat(priceParam) : 0;
  const price = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0;

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const packageName = VALID_PACKAGES.includes(rawPackageName as typeof VALID_PACKAGES[number])
    ? rawPackageName!
    : null;

  if (!packageName || !priceParam || price <= 0) {
    return <Navigate to="/" replace />;
  }

  const vat = price * 0.20;
  const total = price * 1.20;

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const digits = cardNumber.replace(/\s/g, '');
    if (!digits || digits.length < 13 || digits.length > 19 || !/^\d+$/.test(digits)) {
      errors.cardNumber = 'Enter a valid card number (13-19 digits)';
    }

    if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) {
      errors.expiry = 'Enter a valid expiry (MM/YY)';
    } else {
      const [mm, yy] = expiry.split('/').map(Number);
      if (mm < 1 || mm > 12) {
        errors.expiry = 'Month must be 01-12';
      } else {
        const now = new Date();
        const expiryDate = new Date(2000 + yy, mm);
        if (expiryDate <= now) {
          errors.expiry = 'Card has expired';
        }
      }
    }

    if (!cvc || !/^\d{3,4}$/.test(cvc)) {
      errors.cvc = 'Enter a valid CVC (3-4 digits)';
    }

    if (!cardholderName.trim()) {
      errors.cardholder = 'Enter the cardholder name';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setPaymentError(null);

    if (!validateForm()) return;

    setIsProcessing(true);
    try {
      const packageId = PACKAGE_ID_MAP[packageName!];
      const { purchaseId, paymentIntentId } = await api.post<{
        purchaseId: string;
        paymentIntentId: string;
        clientSecret: string;
        packageId: string;
        organisationId: string;
        status: string;
      }>('/api/v1/purchases', { packageId });

      await api.post<{ purchaseId: string; status: string }>(
        `/api/v1/purchases/${purchaseId}/confirm`,
        { paymentIntentId },
      );

      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_PURCHASE') {
        setPaymentError('You already have an active subscription for this package.');
      } else {
        setPaymentError('Payment failed. Please check your card details and try again.');
      }
    } finally {
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
                    <Button className="w-full" asChild>
                      <Link to="/dashboard">Go to Dashboard</Link>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to="/">Back to Home</Link>
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
                    <span>GovS-013 & ECCTA 2023 Compliant</span>
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
                    {paymentError && (
                      <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {paymentError}
                      </div>
                    )}

                    <div>
                      <label htmlFor="card-number" className="block text-sm font-medium mb-1.5">
                        Card Number
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <input
                          id="card-number"
                          type="text"
                          inputMode="numeric"
                          placeholder="1234 5678 9012 3456"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          maxLength={19}
                          aria-required="true"
                          aria-invalid={!!fieldErrors.cardNumber}
                          aria-describedby={fieldErrors.cardNumber ? 'card-number-error' : undefined}
                          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${fieldErrors.cardNumber ? 'border-destructive' : 'border-input'}`}
                        />
                      </div>
                      {fieldErrors.cardNumber && (
                        <p id="card-number-error" role="alert" className="mt-1 text-xs text-destructive">{fieldErrors.cardNumber}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="expiry" className="block text-sm font-medium mb-1.5">
                          Expiry
                        </label>
                        <input
                          id="expiry"
                          type="text"
                          inputMode="numeric"
                          placeholder="MM/YY"
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                          maxLength={5}
                          aria-required="true"
                          aria-invalid={!!fieldErrors.expiry}
                          aria-describedby={fieldErrors.expiry ? 'expiry-error' : undefined}
                          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${fieldErrors.expiry ? 'border-destructive' : 'border-input'}`}
                        />
                        {fieldErrors.expiry && (
                          <p id="expiry-error" role="alert" className="mt-1 text-xs text-destructive">{fieldErrors.expiry}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="cvc" className="block text-sm font-medium mb-1.5">
                          CVC
                        </label>
                        <input
                          id="cvc"
                          type="text"
                          inputMode="numeric"
                          placeholder="123"
                          value={cvc}
                          onChange={(e) => setCvc(e.target.value)}
                          maxLength={4}
                          aria-required="true"
                          aria-invalid={!!fieldErrors.cvc}
                          aria-describedby={fieldErrors.cvc ? 'cvc-error' : undefined}
                          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${fieldErrors.cvc ? 'border-destructive' : 'border-input'}`}
                        />
                        {fieldErrors.cvc && (
                          <p id="cvc-error" role="alert" className="mt-1 text-xs text-destructive">{fieldErrors.cvc}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="cardholder" className="block text-sm font-medium mb-1.5">
                        Cardholder Name
                      </label>
                      <input
                        id="cardholder"
                        type="text"
                        placeholder="Name on card"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value)}
                        aria-required="true"
                        aria-invalid={!!fieldErrors.cardholder}
                        aria-describedby={fieldErrors.cardholder ? 'cardholder-error' : undefined}
                        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${fieldErrors.cardholder ? 'border-destructive' : 'border-input'}`}
                      />
                      {fieldErrors.cardholder && (
                        <p id="cardholder-error" role="alert" className="mt-1 text-xs text-destructive">{fieldErrors.cardholder}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : `Pay \u00A3${total.toFixed(2)}`}
                    </Button>

                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Secure payment</span>
                    </div>
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
