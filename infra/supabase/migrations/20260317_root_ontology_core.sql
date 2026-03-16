-- ROOT Canonical Ontology: Shared-Business OS Data Layer
-- Creates foundation tables (contacts, events, invoices, quotes) if missing,
-- then adds the full ontology: companies, relationships, opportunities,
-- projects, deliverables, campaigns, payments, catalog, automation rules.

create extension if not exists pgcrypto;

-- ══════════════════════════════════════════════════════════════════════
-- FOUNDATION TABLES (may already exist in live DB — IF NOT EXISTS safe)
-- ══════════════════════════════════════════════════════════════════════

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_unit text not null default 'CC',
  domain text,
  logo_url text,
  billing_address jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  name text,
  email text,
  phone text,
  company text,
  business_unit text not null default 'CC',
  status text not null default 'active',
  contact_type text,
  orbit_tier text,
  priority_score numeric default 0,
  lifecycle text,
  last_contacted timestamptz,
  last_activity text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  business_id uuid,
  business_unit text,
  contact_id uuid,
  text text,
  payload jsonb default '{}'::jsonb,
  metadata jsonb,
  channel text default 'root',
  direction text default 'internal',
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  business_id uuid references businesses(id) on delete set null,
  business_unit text not null default 'CC',
  quote_number text,
  estimated_total numeric default 0,
  total numeric default 0,
  status text not null default 'draft',
  internal_status text default 'draft',
  client_status text default 'pending',
  client_name text,
  client_email text,
  client_phone text,
  payment_terms text,
  valid_until timestamptz,
  notes text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  description text,
  phase_name text,
  name text,
  quantity numeric default 1,
  unit text default 'each',
  unit_price numeric default 0,
  total numeric default 0,
  line_total numeric default 0,
  sort_order int default 0,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  customer_id uuid,
  business_unit text not null default 'CC',
  invoice_number text,
  amount numeric default 0,
  tax numeric default 0,
  total numeric default 0,
  balance_due numeric default 0,
  paid_amount numeric default 0,
  amount_paid numeric default 0,
  status text not null default 'draft',
  invoice_status text,
  payment_status text default 'unpaid',
  payment_link_status text,
  reminder_status text default 'idle',
  reconciliation_status text default 'not_started',
  next_action text,
  stripe_payment_link text,
  client_name text,
  client_email text,
  client_phone text,
  notes text,
  line_items jsonb,
  due_date date,
  due_at timestamptz,
  last_reminder_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric not null default 0,
  status text not null default 'completed',
  method text default 'manual',
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists contact_business_map (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  role text,
  created_at timestamptz not null default now(),
  unique (contact_id, business_id)
);

-- Foundation indexes
create index if not exists idx_contacts_business_unit on contacts(business_unit);
create index if not exists idx_contacts_email on contacts(email);
create index if not exists idx_contacts_created_at on contacts(created_at desc);
create index if not exists idx_events_type on events(type);
create index if not exists idx_events_created_at on events(created_at desc);
create index if not exists idx_events_business_unit on events(business_unit);
create index if not exists idx_events_contact_id on events(contact_id);
create index if not exists idx_invoices_business_unit on invoices(business_unit);
create index if not exists idx_invoices_contact_id on invoices(contact_id);
create index if not exists idx_invoices_created_at on invoices(created_at desc);
create index if not exists idx_quotes_business_unit on quotes(business_unit);
create index if not exists idx_quotes_contact_id on quotes(contact_id);
create index if not exists idx_invoice_payments_invoice_id on invoice_payments(invoice_id);

-- ══════════════════════════════════════════════════════════════════════
-- ONTOLOGY LAYER: New canonical tables
-- ══════════════════════════════════════════════════════════════════════

-- Companies (Attio pattern — normalized company records separate from contacts)
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'CC',
  name text not null,
  domain text,
  industry text,
  size text,
  logo_url text,
  billing_address jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_companies_business_unit on companies(business_unit);
create index if not exists idx_companies_domain on companies(domain);

-- Relationships (Attio typed connections — contact↔company)
create table if not exists relationships (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text,
  relationship_type text not null default 'employee',
  is_primary boolean default false,
  started_at date,
  ended_at date,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_relationships_contact on relationships(contact_id);
create index if not exists idx_relationships_company on relationships(company_id);

-- Opportunities (HubSpot deal pipeline)
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'CC',
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  title text not null,
  stage text not null default 'discovery',
  pipeline text not null default 'default',
  value_cents bigint default 0,
  currency text default 'CAD',
  probability int default 0,
  expected_close_date date,
  owner_id uuid,
  lost_reason text,
  won_at timestamptz,
  lost_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_opportunities_business_unit on opportunities(business_unit);
create index if not exists idx_opportunities_stage on opportunities(stage);
create index if not exists idx_opportunities_contact on opportunities(contact_id);
create index if not exists idx_opportunities_company on opportunities(company_id);

-- Projects (Airtable pattern — CC deliverable tracking + ACS job grouping)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'CC',
  company_id uuid references companies(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  opportunity_id uuid references opportunities(id) on delete set null,
  title text not null,
  status text not null default 'planning',
  project_type text,
  start_date date,
  due_date date,
  budget_cents bigint default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_business_unit on projects(business_unit);
create index if not exists idx_projects_status on projects(status);
create index if not exists idx_projects_company on projects(company_id);
create index if not exists idx_projects_contact on projects(contact_id);

-- Deliverables (CC creative assets within projects)
create table if not exists deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  deliverable_type text not null default 'video',
  status text not null default 'draft',
  assignee_id uuid,
  due_date date,
  brief jsonb,
  review_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_deliverables_project on deliverables(project_id);
create index if not exists idx_deliverables_status on deliverables(status);
create index if not exists idx_deliverables_assignee on deliverables(assignee_id);

-- Campaigns (HubSpot marketing orchestration)
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'CC',
  title text not null,
  campaign_type text not null default 'outbound',
  status text not null default 'draft',
  start_date date,
  end_date date,
  budget_cents bigint default 0,
  channels text[] default '{}',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaigns_business_unit on campaigns(business_unit);
create index if not exists idx_campaigns_status on campaigns(status);

-- Campaign-Contact junction (enrollment tracking)
create table if not exists campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  status text not null default 'enrolled',
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  unique (campaign_id, contact_id)
);

create index if not exists idx_campaign_contacts_campaign on campaign_contacts(campaign_id);
create index if not exists idx_campaign_contacts_contact on campaign_contacts(contact_id);

-- Payments (FreshBooks ledger — unified payment tracking)
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'CC',
  invoice_id uuid references invoices(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  amount_cents bigint not null default 0,
  currency text default 'CAD',
  method text default 'manual',
  status text not null default 'completed',
  reference_number text,
  paid_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_business_unit on payments(business_unit);
create index if not exists idx_payments_invoice on payments(invoice_id);
create index if not exists idx_payments_contact on payments(contact_id);
create index if not exists idx_payments_paid_at on payments(paid_at desc);

-- Catalog items (promote from in-memory root-catalog.ts to DB)
create table if not exists catalog_items (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'ALL',
  code text not null,
  name text not null,
  description text,
  category text,
  unit_price_cents bigint default 0,
  default_unit text default 'each',
  currency text default 'CAD',
  revenue_account_code text,
  cost_account_code text,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_catalog_items_code on catalog_items(code);
create index if not exists idx_catalog_items_business_unit on catalog_items(business_unit);
create index if not exists idx_catalog_items_active on catalog_items(is_active) where is_active = true;

-- Automation rules (declarative BLAZE rules in DB)
create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'ALL',
  name text not null,
  description text,
  trigger_event text not null,
  conditions jsonb default '[]'::jsonb,
  actions jsonb default '[]'::jsonb,
  is_active boolean default true,
  last_triggered_at timestamptz,
  run_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_automation_rules_trigger on automation_rules(trigger_event);
create index if not exists idx_automation_rules_active on automation_rules(is_active) where is_active = true;

-- Automation execution log
create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references automation_rules(id) on delete cascade,
  trigger_event_id uuid references events(id) on delete set null,
  status text not null default 'running',
  input_payload jsonb default '{}'::jsonb,
  result jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_automation_runs_rule on automation_runs(rule_id);
create index if not exists idx_automation_runs_status on automation_runs(status);

-- ══════════════════════════════════════════════════════════════════════
-- ALTER EXISTING TABLES: Add ontology columns
-- ══════════════════════════════════════════════════════════════════════

-- contacts: add lead scoring + company link
do $$ begin
  alter table contacts add column if not exists lead_score int default 0;
  alter table contacts add column if not exists lead_status text default 'new';
  alter table contacts add column if not exists company_id uuid references companies(id) on delete set null;
  alter table contacts add column if not exists lifecycle_stage text default 'subscriber';
exception when others then null;
end $$;

-- events: add object binding for typed event stream
do $$ begin
  alter table events add column if not exists object_type text;
  alter table events add column if not exists object_id uuid;
  alter table events add column if not exists event_category text;
exception when others then null;
end $$;

create index if not exists idx_events_object on events(object_type, object_id);
create index if not exists idx_events_category on events(event_category);

-- invoices: add recurrence + enhanced payment tracking
do $$ begin
  alter table invoices add column if not exists recurrence_rule text;
  alter table invoices add column if not exists next_recurrence_date date;
  alter table invoices add column if not exists paid_amount_cents bigint default 0;
  alter table invoices add column if not exists balance_cents bigint;
exception when others then null;
end $$;

-- ══════════════════════════════════════════════════════════════════════
-- SEED: Catalog items from root-catalog.ts
-- ══════════════════════════════════════════════════════════════════════

insert into catalog_items (id, business_unit, code, name, category, unit_price_cents, default_unit, revenue_account_code, cost_account_code, is_active)
values
  (gen_random_uuid(), 'CC', 'STRAT-RET', 'strategy retainer', 'strategy', 250000, 'project', '4000', '5100', true),
  (gen_random_uuid(), 'CC', 'PROD-DAY', 'production day', 'production', 180000, 'day', '4010', '5200', true),
  (gen_random_uuid(), 'CC', 'POST-EDIT', 'editorial package', 'post-production', 220000, 'project', '4020', '5210', true),
  (gen_random_uuid(), 'CC', 'MOTION', 'motion graphics block', 'design', 95000, 'block', '4030', '5220', true),
  (gen_random_uuid(), 'CC', 'WEB-SPR', 'web sprint', 'web', 160000, 'sprint', '4040', '5230', true),
  (gen_random_uuid(), 'ACS', 'CLEAN-STD', 'standard cleaning visit', 'recurring service', 18000, 'visit', '4100', '5300', true),
  (gen_random_uuid(), 'ACS', 'CLEAN-DEEP', 'deep cleaning visit', 'one-time service', 32000, 'visit', '4110', '5310', true),
  (gen_random_uuid(), 'ACS', 'MOVE-OUT', 'move out cleaning', 'one-time service', 42000, 'visit', '4120', '5320', true),
  (gen_random_uuid(), 'ACS', 'ADD-WIN', 'window add-on', 'add-on', 6500, 'service', '4130', '5330', true),
  (gen_random_uuid(), 'ALL', 'TRAVEL', 'travel fee', 'reimbursable', 7500, 'trip', '4800', '5400', true),
  (gen_random_uuid(), 'ALL', 'RUSH', 'rush turnaround', 'surcharge', 15000, 'service', '4810', '5410', true)
on conflict (code) do nothing;

-- ══════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGERS
-- ══════════════════════════════════════════════════════════════════════

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  create trigger trg_contacts_updated_at before update on contacts for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_companies_updated_at before update on companies for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_relationships_updated_at before update on relationships for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_opportunities_updated_at before update on opportunities for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_projects_updated_at before update on projects for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_deliverables_updated_at before update on deliverables for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_campaigns_updated_at before update on campaigns for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_invoices_updated_at before update on invoices for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_quotes_updated_at before update on quotes for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_catalog_items_updated_at before update on catalog_items for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_automation_rules_updated_at before update on automation_rules for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_businesses_updated_at before update on businesses for each row execute function set_updated_at();
exception when duplicate_object then null;
end $$;

-- ══════════════════════════════════════════════════════════════════════
-- RLS POLICIES (service role bypasses, but enables future user-scoped access)
-- ══════════════════════════════════════════════════════════════════════

alter table companies enable row level security;
alter table relationships enable row level security;
alter table opportunities enable row level security;
alter table projects enable row level security;
alter table deliverables enable row level security;
alter table campaigns enable row level security;
alter table campaign_contacts enable row level security;
alter table payments enable row level security;
alter table catalog_items enable row level security;
alter table automation_rules enable row level security;
alter table automation_runs enable row level security;

-- Service role full access policies
do $$ begin
  create policy "service_role_companies" on companies for all using (true) with check (true);
  create policy "service_role_relationships" on relationships for all using (true) with check (true);
  create policy "service_role_opportunities" on opportunities for all using (true) with check (true);
  create policy "service_role_projects" on projects for all using (true) with check (true);
  create policy "service_role_deliverables" on deliverables for all using (true) with check (true);
  create policy "service_role_campaigns" on campaigns for all using (true) with check (true);
  create policy "service_role_campaign_contacts" on campaign_contacts for all using (true) with check (true);
  create policy "service_role_payments" on payments for all using (true) with check (true);
  create policy "service_role_catalog_items" on catalog_items for all using (true) with check (true);
  create policy "service_role_automation_rules" on automation_rules for all using (true) with check (true);
  create policy "service_role_automation_runs" on automation_runs for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
