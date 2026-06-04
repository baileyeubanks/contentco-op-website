create extension if not exists pgcrypto;

alter table creative_briefs
  add column if not exists brief_number text,
  add column if not exists readiness_score numeric default 0,
  add column if not exists internal_status text default 'submitted',
  add column if not exists normalized_scope_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_creative_briefs_brief_number
  on creative_briefs(brief_number)
  where brief_number is not null;

create table if not exists brief_scope_items (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references creative_briefs(id) on delete cascade,
  business_unit text not null default 'CC',
  item_type text not null,
  scope_bucket text not null,
  label text not null,
  quantity numeric not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_brief_scope_items_brief on brief_scope_items(brief_id, sort_order);
create index if not exists idx_brief_scope_items_business on brief_scope_items(business_unit, created_at desc);

create table if not exists estimates (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'CC',
  brief_id uuid not null references creative_briefs(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  legacy_quote_id uuid references quotes(id) on delete set null,
  estimate_number text not null,
  document_version int not null default 1,
  currency text not null default 'USD',
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  deposit_percent int not null default 50,
  deposit_due_cents bigint not null default 0,
  balance_remaining_cents bigint not null default 0,
  assumptions text[] not null default '{}',
  exclusions text[] not null default '{}',
  payment_terms text,
  delivery_timeline text,
  internal_status text not null default 'draft',
  client_status text not null default 'not_sent',
  approval_status text not null default 'not_required',
  scope_snapshot jsonb not null default '{}'::jsonb,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  valid_until timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  superseded_by_estimate_id uuid references estimates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_estimates_number on estimates(estimate_number);
create index if not exists idx_estimates_brief on estimates(brief_id, created_at desc);
create index if not exists idx_estimates_contact on estimates(contact_id, created_at desc);
create index if not exists idx_estimates_legacy_quote on estimates(legacy_quote_id) where legacy_quote_id is not null;
create index if not exists idx_estimates_internal_status on estimates(internal_status, created_at desc);
create index if not exists idx_estimates_client_status on estimates(client_status, created_at desc);

create table if not exists estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  phase_name text not null,
  line_type text not null,
  description text not null,
  quantity numeric not null default 1,
  unit text not null default 'each',
  unit_price_cents bigint not null default 0,
  line_total_cents bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_estimate_line_items_estimate on estimate_line_items(estimate_id, sort_order);

create table if not exists estimate_decisions (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  decision_type text not null,
  actor_type text not null default 'unknown',
  actor_id text,
  actor_email text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_estimate_decisions_estimate on estimate_decisions(estimate_id, created_at desc);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'CC',
  object_type text not null,
  object_id uuid not null,
  approval_type text not null,
  policy_type text not null,
  status text not null default 'pending',
  requested_by text,
  decided_by text,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists idx_approvals_object on approvals(object_type, object_id, created_at desc);
create index if not exists idx_approvals_status on approvals(status, created_at desc);

create table if not exists approval_policies (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'CC',
  policy_type text not null,
  approval_type text not null,
  status text not null default 'active',
  threshold_value numeric,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_unit, policy_type)
);

insert into approval_policies (business_unit, policy_type, approval_type, threshold_value, config)
values
  ('CC', 'low_confidence_send', 'estimate_send_gate', 0.65, '{"requires_reason":true}'::jsonb),
  ('CC', 'manual_price_override', 'estimate_send_gate', null, '{"requires_reason":true}'::jsonb),
  ('CC', 'discount_over_threshold', 'estimate_send_gate', 0.15, '{"requires_reason":true}'::jsonb),
  ('CC', 'waive_deposit', 'schedule_override', null, '{"requires_reason":true}'::jsonb),
  ('CC', 'schedule_without_deposit', 'schedule_override', null, '{"requires_reason":true}'::jsonb)
on conflict (business_unit, policy_type) do nothing;

alter table invoices
  add column if not exists brief_id uuid references creative_briefs(id) on delete set null,
  add column if not exists estimate_id uuid references estimates(id) on delete set null,
  add column if not exists invoice_type text default 'standard',
  add column if not exists document_status text default 'draft',
  add column if not exists approval_status text default 'not_required',
  add column if not exists amount_due_cents bigint default 0,
  add column if not exists amount_paid_cents bigint default 0,
  add column if not exists balance_due_cents bigint default 0,
  add column if not exists payment_link_url text,
  add column if not exists scope_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists issued_at timestamptz,
  add column if not exists paid_at timestamptz;

create index if not exists idx_invoices_estimate on invoices(estimate_id, created_at desc);
create index if not exists idx_invoices_type on invoices(invoice_type, created_at desc);

create table if not exists payment_attempts (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'CC',
  invoice_id uuid references invoices(id) on delete set null,
  estimate_id uuid references estimates(id) on delete set null,
  status text not null default 'pending',
  provider text default 'stripe',
  provider_reference_id text,
  amount_cents bigint not null default 0,
  currency text not null default 'USD',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_attempts_invoice on payment_attempts(invoice_id, created_at desc);
create index if not exists idx_payment_attempts_status on payment_attempts(status, created_at desc);

alter table payments
  add column if not exists quote_id uuid references quotes(id) on delete set null,
  add column if not exists estimate_id uuid references estimates(id) on delete set null,
  add column if not exists payment_attempt_id uuid references payment_attempts(id) on delete set null,
  add column if not exists invoice_type text,
  add column if not exists provider text,
  add column if not exists provider_reference_id text,
  add column if not exists raw_status text,
  add column if not exists payload jsonb not null default '{}'::jsonb;

create index if not exists idx_payments_estimate on payments(estimate_id, paid_at desc);
create index if not exists idx_payments_quote on payments(quote_id, paid_at desc);

create table if not exists commercial_workflows (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'CC',
  brief_id uuid references creative_briefs(id) on delete cascade,
  estimate_id uuid references estimates(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  current_status text not null default 'briefed',
  readiness_status text not null default 'briefed',
  schedule_waiver_approved boolean not null default false,
  schedule_waiver_approval_id uuid references approvals(id) on delete set null,
  ready_to_schedule_at timestamptz,
  last_transition_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_commercial_workflows_brief on commercial_workflows(brief_id) where brief_id is not null;
create unique index if not exists idx_commercial_workflows_estimate on commercial_workflows(estimate_id) where estimate_id is not null;
create index if not exists idx_commercial_workflows_status on commercial_workflows(current_status, readiness_status, updated_at desc);

create index if not exists idx_document_artifacts_source_type on document_artifacts(source_document_id, document_type, created_at desc);
