import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type ConfirmOptions = {
  title: string;
  description?: string;
  /** Label for the confirming button, e.g. "Revoke" or "Delete" */
  confirmLabel: string;
  /** Destructive actions get the destructive button style */
  destructive?: boolean;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * One in-page confirmation dialog for the whole app, replacing window.confirm, which some
 * embedded browsers block and which cannot be styled or reliably announced.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((opts) => new Promise<boolean>((resolve) => {
    resolver.current?.(false); // a newer question replaces an unanswered one
    resolver.current = resolve;
    setOptions(opts);
  }), []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!options} onOpenChange={(open) => { if (!open) settle(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            {options?.description && <AlertDialogDescription>{options.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={options?.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
            >
              {options?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

/** `if (!(await confirm({ title, confirmLabel }))) return;` Outside the provider it falls back to window.confirm. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  return confirm ?? (async (o) => window.confirm(o.description ? `${o.title}\n\n${o.description}` : o.title));
}
