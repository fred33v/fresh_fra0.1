import { cn } from '@/lib/utils';

/** Decorative when adjacent to the product name; keep the link's accessible name in text. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand-mark.png"
      width={40}
      height={40}
      alt=""
      aria-hidden="true"
      className={cn('h-10 w-10 shrink-0 object-contain', className)}
    />
  );
}
