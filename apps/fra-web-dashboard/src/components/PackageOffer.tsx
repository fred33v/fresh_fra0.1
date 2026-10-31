import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PACKAGES, checkoutPath, formatPrice } from '@/data/packages';

// The 13 areas of the risk assessment questionnaire (ASSESSMENT_MODULES on the backend)
const ASSESSMENT_AREAS = [
  'Risk appetite', 'Fraud triangle', 'Procurement', 'Cash and banking', 'Payroll and HR',
  'Revenue and income', 'IT systems and cybersecurity', 'People and culture', 'Controls and technology',
  'Training and awareness', 'Monitoring and evaluation', 'Compliance', 'Fraud response',
];

/** What an organisation with no package can buy, with prices and a direct way to pay. */
export function PackageOffer() {
  return (
    <section aria-labelledby="package-offer-heading" className="mb-6">
      <h2 id="package-offer-heading" className="text-xl font-semibold mb-1">Choose your package</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Every package starts with your organisation&apos;s fraud risk assessment. Prices exclude VAT.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {PACKAGES.map((pkg, index) => (
          <Card key={pkg.id} className={pkg.name === 'Professional' ? 'border-primary' : undefined}>
            <CardHeader className="pb-3">
              <CardTitle level={3} className="text-lg">Package {index + 1}: {pkg.name}</CardTitle>
              <CardDescription>{pkg.audience}</CardDescription>
              <p className="pt-2">
                <span className="text-2xl font-bold">{formatPrice(pkg)}</span>
                <span className="text-sm text-muted-foreground"> + VAT {pkg.billing === 'one-time' ? 'one-time' : 'per year'}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-1.5 text-sm">
                {pkg.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-success" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {pkg.name === 'Starter' && (
                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer">The 13 areas assessed</summary>
                  <p className="mt-1">{ASSESSMENT_AREAS.join(', ')}.</p>
                </details>
              )}
              <Button asChild className="w-full" variant={pkg.name === 'Professional' ? 'default' : 'outline'}>
                <Link to={checkoutPath(pkg)}>Choose {pkg.name}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
