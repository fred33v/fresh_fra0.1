-- Additive payment evidence. No purchase, training or certificate records are removed.
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS refunded_amount_cents integer NOT NULL DEFAULT 0 CHECK (refunded_amount_cents >= 0);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS dispute_status text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_reconciled_at timestamptz;
CREATE TABLE IF NOT EXISTS public.payment_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
-- Completed receipts commit with the purchase/audit. Failed transactions leave no receipt.
-- Store identifiers only, not provider payloads, customer details or card information.
