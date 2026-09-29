import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getPackage, checkoutPath } from '@/data/packages';
import type { Entitlements } from '@/hooks/useEntitlements';

const RENEWAL_WINDOW_DAYS = 30; // matches the backend renewal window

/** Package, renewal date and a renew prompt once the renewal window opens. */
export function SubscriptionCard({ entitlements }: { entitlements: Entitlements | null }) {
  if (!entitlements?.packageId) return null;

  const pkg = getPackage(entitlements.packageId);
  const expires = entitlements.expiresAt ? new Date(entitlements.expiresAt) : null;
  const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
  const renewSoon = daysLeft !== null && daysLeft <= RENEWAL_WINDOW_DAYS;

  return (
    <Card className={renewSoon ? 'border-amber-400 dark:border-amber-700' : undefined}>
      <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-medium">{entitlements.packageName} package</p>
            <p className="text-sm text-muted-foreground">
              {expires
                ? `Renews ${expires.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}${daysLeft !== null && daysLeft >= 0 ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ''}`
                : 'One-time purchase'}
            </p>
          </div>
        </div>
        {renewSoon && pkg && (
          <Button asChild size="sm">
            <Link to={checkoutPath(pkg)}>Renew now</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
