-- Date-filtered reporting and per-purchase ledger reconciliation; no financial data changes.
CREATE INDEX provider_sales_purchase_dates ON public.purchases(created_at,id);
CREATE INDEX provider_sales_ledger_purchase ON public.provider_commission_entries(purchase_id,currency);
