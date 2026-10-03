import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';

export type ComplianceStatus = 'met' | 'partial' | 'not_met';

// 700-weight text keeps WCAG AA contrast on white and on the muted card backgrounds
const STATUS_META: Record<ComplianceStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  met: { label: 'Met', icon: CheckCircle2, className: 'text-emerald-700 dark:text-emerald-400' },
  partial: { label: 'Partly met', icon: CircleDashed, className: 'text-amber-700 dark:text-amber-400' },
  not_met: { label: 'Not met', icon: XCircle, className: 'text-red-700 dark:text-red-400' },
};

export function StatusLabel({ status }: { status: ComplianceStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${meta.className}`}>
      <Icon className="h-4 w-4" aria-hidden="true" /> {meta.label}
    </span>
  );
}
