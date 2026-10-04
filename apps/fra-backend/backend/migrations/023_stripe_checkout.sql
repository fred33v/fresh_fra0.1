-- Migration: 023_stripe_checkout.sql
-- Card payments go through Stripe Checkout. Each purchase keeps the Checkout
-- Session that pays for it; payment_intent_id then holds Stripe's real
-- PaymentIntent once the session is paid. client_secret is no longer written.

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS checkout_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_checkout_session_id_idx
    ON public.purchases(checkout_session_id) WHERE checkout_session_id IS NOT NULL;
