import { Link } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements, type EntitlementFeature } from '@/hooks/useEntitlements';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const FEATURE_PACKAGE: Record<EntitlementFeature, { name: string; path: string }> = {
  assessment: { name: 'Starter', path: '/package/starter' },
  training: { name: 'Professional', path: '/package/professional' },
  certificates: { name: 'Professional', path: '/package/professional' },
  dashboard: { name: 'Enterprise', path: '/package/enterprise' },
  compliance: { name: 'Enterprise', path: '/package/enterprise' },
};

interface PackageGateProps {
  feature: EntitlementFeature;
  children: React.ReactNode;
}

/** Shows an upgrade prompt instead of the page when the organisation's package lacks the feature. */
export function PackageGate({ feature, children }: PackageGateProps) {
  const { user, hasRole } = useAuth();
  const { entitlements, isLoading } = useEntitlements();

  // Facilitators and admins run the workshops, mirroring the backend exemption
  if (user?.role === 'admin' || hasRole('facilitator')) return <>{children}</>;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (entitlements?.features[feature]) return <>{children}</>;

  const required = FEATURE_PACKAGE[feature];
  return (
    <Layout>
      <div className="container max-w-xl py-16">
        <Card>
          <CardHeader>
            <Lock className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
            <CardTitle level={1}>Included in the {required.name} package</CardTitle>
            <CardDescription>
              {entitlements?.packageName
                ? `Your organisation is on the ${entitlements.packageName} package, which does not include this feature.`
                : 'Your organisation does not have an active package yet.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to={required.path}>See the {required.name} package</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
