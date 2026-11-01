import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shown when a list could not be loaded. Never show an empty list instead: on a compliance
 * page "nothing found" reads as "all clear", which a failed request has not established.
 */
export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      <p className="text-sm">We could not load {what}. Nothing has been checked, so this is not a clean result.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Try again
      </Button>
    </div>
  );
}
