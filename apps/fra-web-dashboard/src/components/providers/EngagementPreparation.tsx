import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ProviderApplication } from '@/lib/providers';
import { downloadProviderPreparation, engagementPreparationSteps } from '@/lib/providerPreparation';

export default function EngagementPreparation({
  application,
}: {
  application: ProviderApplication;
}) {
  const [error, setError] = useState('');
  return (
    <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <h3 className="font-semibold">Prepare the independent services agreement</h3>
      <p className="text-sm text-muted-foreground">
        Download this revision for discussion with the review team. The dossier contains private
        candidate information. It is a preparation summary, not an agreement to sign.
      </p>
      {application.status !== 'approved' && (
        <p className="text-sm text-amber-900">
          Programme approval is still required before proceeding with engagement. You can prepare
          questions while the application is reviewed.
        </p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Steps before starting work</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
          {engagementPreparationSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          These are preparation steps; their completion is not recorded here. Programme approval
          does not confirm a signed agreement. Payment setup follows in the final financial step.
        </p>
      </details>
      <Button
        variant="outline"
        onClick={() => {
          setError('');
          try {
            downloadProviderPreparation(application);
          } catch {
            setError('The dossier could not be downloaded. Please try again.');
          }
        }}
      >
        Download preparation dossier
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
