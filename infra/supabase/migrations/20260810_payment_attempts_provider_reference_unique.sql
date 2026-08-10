-- Replay protection for payment webhooks (Stripe, etc.).
-- A provider reference (e.g. Stripe payment intent / checkout session id) may
-- only be recorded once, so a replayed or forged webhook delivery cannot
-- double-apply a payment. Partial index because provider_reference_id is
-- nullable: manual/cash payments without a provider reference are unaffected.
create unique index if not exists idx_payment_attempts_provider_reference_unique
  on payment_attempts (provider_reference_id)
  where provider_reference_id is not null;
