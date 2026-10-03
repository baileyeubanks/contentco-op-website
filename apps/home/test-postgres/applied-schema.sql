-- ISOLATED TEST FIXTURE ONLY. Never run against an existing or production database.
CREATE SCHEMA auth; CREATE SCHEMA co_production;
CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TABLE public.contacts(id uuid PRIMARY KEY); CREATE TABLE public.businesses(id uuid PRIMARY KEY); CREATE TABLE public.orgs(id uuid PRIMARY KEY); CREATE TABLE public.quotes(id uuid PRIMARY KEY);
CREATE TABLE co_production.teams(id uuid PRIMARY KEY); CREATE TABLE co_production.versions(id uuid PRIMARY KEY);
CREATE TABLE co_production.contacts (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "role" text,
  "is_primary" bool DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE co_production.deliverables (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "created_by" uuid,
  "name" text NOT NULL,
  "spec" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_version_id" uuid,
  "status" text DEFAULT 'specced'::text NOT NULL,
  "qc_notes" text DEFAULT ''::text NOT NULL,
  "delivered_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "qc_checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "locked_at" timestamptz,
  "locked_by" uuid,
  "approval_id" uuid
);
CREATE TABLE co_production.inquiries (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "project_id" uuid,
  "organization_id" uuid,
  "contact_id" uuid,
  "source" text DEFAULT 'direct'::text NOT NULL,
  "summary" text DEFAULT ''::text NOT NULL,
  "received_at" timestamptz DEFAULT now() NOT NULL,
  "status" text DEFAULT 'new'::text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "cco_estimate_id" uuid,
  "cco_estimate_version_id" uuid,
  "commercial_total_cents" int8,
  "commercial_ref" jsonb
);
CREATE TABLE co_production.organizations (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "industry" text,
  "website" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE co_production.project_members (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text DEFAULT 'reviewer'::text NOT NULL,
  "invited_by" uuid,
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE co_production.projects (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "thumbnail_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "stage" text DEFAULT 'post'::text NOT NULL,
  "organization_id" uuid,
  "primary_contact_id" uuid,
  "cco_estimate_id" uuid,
  "cco_estimate_version_id" uuid,
  "commercial_total_cents" int8,
  "commercial_ref" jsonb
);
CREATE TABLE public.commercial_handoffs (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "estimate_id" uuid NOT NULL,
  "estimate_version_id" uuid NOT NULL,
  "idempotency_key" text NOT NULL,
  "payload_hash" text NOT NULL,
  "cvp_inquiry_id" uuid,
  "cvp_project_id" uuid,
  "receipt" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.creative_briefs (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "access_token" text DEFAULT encode(gen_random_bytes(32), 'hex'::text) NOT NULL,
  "status" text DEFAULT 'submitted'::text NOT NULL,
  "contact_name" text NOT NULL,
  "contact_email" text NOT NULL,
  "company" text,
  "role" text,
  "content_type" text,
  "deliverables" text,
  "audience" text,
  "tone" text,
  "deadline" date,
  "objective" text,
  "key_messages" text,
  "references" text,
  "constraints" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "phone" text,
  "location" text,
  "embedding" vector,
  "booking_intent" text,
  "source_surface" text,
  "source_path" text,
  "submission_mode" text,
  "intake_payload" jsonb,
  "structured_intake" jsonb,
  "handoff_payload" jsonb,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "company_account_id" text DEFAULT 'content-co-op'::text NOT NULL,
  "brief_number" text,
  "readiness_score" numeric DEFAULT 0,
  "internal_status" text DEFAULT 'submitted'::text,
  "normalized_scope_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE TABLE public.estimate_versions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "estimate_id" uuid NOT NULL,
  "version" int4 NOT NULL,
  "frozen_at" timestamptz DEFAULT now() NOT NULL,
  "snapshot" jsonb NOT NULL,
  "sha256" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.estimates (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "business_unit" text DEFAULT 'CC'::text NOT NULL,
  "brief_id" uuid NOT NULL,
  "contact_id" uuid,
  "legacy_quote_id" uuid,
  "estimate_number" text NOT NULL,
  "document_version" int4 DEFAULT 1 NOT NULL,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "subtotal_cents" int8 DEFAULT 0 NOT NULL,
  "tax_cents" int8 DEFAULT 0 NOT NULL,
  "total_cents" int8 DEFAULT 0 NOT NULL,
  "deposit_percent" int4 DEFAULT 50 NOT NULL,
  "deposit_due_cents" int8 DEFAULT 0 NOT NULL,
  "balance_remaining_cents" int8 DEFAULT 0 NOT NULL,
  "assumptions" _text DEFAULT '{}'::text[] NOT NULL,
  "exclusions" _text DEFAULT '{}'::text[] NOT NULL,
  "payment_terms" text,
  "delivery_timeline" text,
  "internal_status" text DEFAULT 'draft'::text NOT NULL,
  "client_status" text DEFAULT 'not_sent'::text NOT NULL,
  "approval_status" text DEFAULT 'not_required'::text NOT NULL,
  "scope_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "pricing_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "valid_until" timestamptz,
  "sent_at" timestamptz,
  "viewed_at" timestamptz,
  "approved_at" timestamptz,
  "rejected_at" timestamptz,
  "rejection_reason" text,
  "superseded_by_estimate_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "active_version_id" uuid
);
CREATE TABLE public.estimate_decisions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "estimate_id" uuid NOT NULL,
  "decision_type" text NOT NULL,
  "actor_type" text DEFAULT 'unknown'::text NOT NULL,
  "actor_id" text,
  "actor_email" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "estimate_version_id" uuid
);
CREATE TABLE public.projects (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "owner_id" uuid DEFAULT auth.uid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "thumbnail_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "org_id" uuid,
  "created_by" text
);
CREATE TABLE public.events (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "contact_id" uuid,
  "business_id" uuid,
  "type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "processed_at" timestamptz,
  "processed_by" text,
  "process_error" text,
  "attempts" int4 DEFAULT 0,
  "event_version" text DEFAULT 'v1'::text NOT NULL,
  "business_unit" text DEFAULT 'ACS'::text,
  "channel" text DEFAULT 'legacy'::text,
  "direction" text DEFAULT 'inbound'::text,
  "external_thread_id" text,
  "text" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "received_at" timestamptz DEFAULT now(),
  "processing_state" text DEFAULT 'queued'::text,
  "locked_by" text,
  "locked_at" timestamptz,
  "decision_id" text,
  "idempotency_key" text
);
ALTER TABLE co_production.contacts ADD CONSTRAINT "contacts_pkey" PRIMARY KEY (id);
ALTER TABLE co_production.deliverables ADD CONSTRAINT "deliverables_pkey" PRIMARY KEY (id);
ALTER TABLE co_production.inquiries ADD CONSTRAINT "inquiries_pkey" PRIMARY KEY (id);
ALTER TABLE co_production.organizations ADD CONSTRAINT "organizations_pkey" PRIMARY KEY (id);
ALTER TABLE co_production.project_members ADD CONSTRAINT "project_members_pkey" PRIMARY KEY (id);
ALTER TABLE co_production.project_members ADD CONSTRAINT "project_members_project_id_user_id_key" UNIQUE (project_id, user_id);
ALTER TABLE co_production.projects ADD CONSTRAINT "projects_pkey" PRIMARY KEY (id);
ALTER TABLE public.commercial_handoffs ADD CONSTRAINT "commercial_handoffs_idempotency_key_key" UNIQUE (idempotency_key);
ALTER TABLE public.commercial_handoffs ADD CONSTRAINT "commercial_handoffs_pkey" PRIMARY KEY (id);
ALTER TABLE public.creative_briefs ADD CONSTRAINT "creative_briefs_access_token_key" UNIQUE (access_token);
ALTER TABLE public.creative_briefs ADD CONSTRAINT "creative_briefs_pkey" PRIMARY KEY (id);
ALTER TABLE public.estimate_versions ADD CONSTRAINT "estimate_versions_estimate_id_version_key" UNIQUE (estimate_id, version);
ALTER TABLE public.estimate_versions ADD CONSTRAINT "estimate_versions_pkey" PRIMARY KEY (id);
ALTER TABLE public.estimates ADD CONSTRAINT "estimates_pkey" PRIMARY KEY (id);
ALTER TABLE public.estimate_decisions ADD CONSTRAINT "estimate_decisions_pkey" PRIMARY KEY (id);
ALTER TABLE public.events ADD CONSTRAINT "events_pkey" PRIMARY KEY (id);
ALTER TABLE public.projects ADD CONSTRAINT "projects_pkey" PRIMARY KEY (id);
ALTER TABLE co_production.contacts ADD CONSTRAINT "contacts_email_check" CHECK (((length(btrim(email)) >= 3) AND (length(btrim(email)) <= 320)));
ALTER TABLE co_production.contacts ADD CONSTRAINT "contacts_name_check" CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 240)));
ALTER TABLE co_production.deliverables ADD CONSTRAINT "deliverables_delivered_requires_lock" CHECK (((status <> 'delivered'::text) OR (locked_at IS NOT NULL)));
ALTER TABLE co_production.deliverables ADD CONSTRAINT "deliverables_name_check" CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 240)));
ALTER TABLE co_production.deliverables ADD CONSTRAINT "deliverables_status_check" CHECK ((status = ANY (ARRAY['specced'::text, 'encoding'::text, 'qc'::text, 'ready'::text, 'delivered'::text, 'expired'::text])));
ALTER TABLE co_production.inquiries ADD CONSTRAINT "inquiries_commercial_total_cents_check" CHECK (((commercial_total_cents IS NULL) OR (commercial_total_cents >= 0)));
ALTER TABLE co_production.inquiries ADD CONSTRAINT "inquiries_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'triaged'::text, 'qualified'::text, 'converted'::text, 'declined'::text])));
ALTER TABLE co_production.organizations ADD CONSTRAINT "organizations_name_check" CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 240)));
ALTER TABLE co_production.project_members ADD CONSTRAINT "project_members_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'producer'::text, 'editor'::text, 'reviewer'::text, 'viewer'::text])));
ALTER TABLE co_production.projects ADD CONSTRAINT "projects_commercial_total_cents_check" CHECK (((commercial_total_cents IS NULL) OR (commercial_total_cents >= 0)));
ALTER TABLE co_production.projects ADD CONSTRAINT "projects_name_check" CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 240)));
ALTER TABLE co_production.projects ADD CONSTRAINT "projects_stage_check" CHECK ((stage = ANY (ARRAY['inquiry'::text, 'intake'::text, 'development'::text, 'preproduction'::text, 'production'::text, 'post'::text, 'review'::text, 'delivery'::text, 'archived'::text])));
ALTER TABLE co_production.projects ADD CONSTRAINT "projects_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'completed'::text])));
ALTER TABLE public.commercial_handoffs ADD CONSTRAINT "commercial_handoffs_payload_hash_check" CHECK ((payload_hash ~ '^sha256:[0-9a-f]{64}$'::text));
ALTER TABLE public.creative_briefs ADD CONSTRAINT "creative_briefs_status_check" CHECK ((status = ANY (ARRAY['submitted'::text, 'reviewed'::text, 'in_progress'::text, 'delivered'::text, 'closed'::text])));
ALTER TABLE public.estimate_versions ADD CONSTRAINT "estimate_versions_sha256_check" CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text));
ALTER TABLE public.estimate_versions ADD CONSTRAINT "estimate_versions_version_check" CHECK ((version > 0));
ALTER TABLE public.events ADD CONSTRAINT "events_business_unit_contract_check" CHECK (((business_unit IS NULL) OR (business_unit = ANY (ARRAY['ACS'::text, 'CC'::text])))) NOT VALID;
ALTER TABLE public.projects ADD CONSTRAINT "projects_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'completed'::text])));
ALTER TABLE co_production.contacts ADD CONSTRAINT "contacts_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES co_production.organizations(id) ON DELETE SET NULL;
ALTER TABLE co_production.contacts ADD CONSTRAINT "contacts_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE co_production.deliverables ADD CONSTRAINT "deliverables_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE co_production.deliverables ADD CONSTRAINT "deliverables_locked_by_fkey" FOREIGN KEY (locked_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE co_production.deliverables ADD CONSTRAINT "deliverables_project_id_fkey" FOREIGN KEY (project_id) REFERENCES co_production.projects(id) ON DELETE CASCADE;
ALTER TABLE co_production.deliverables ADD CONSTRAINT "deliverables_source_version_id_fkey" FOREIGN KEY (source_version_id) REFERENCES co_production.versions(id) ON DELETE SET NULL;
ALTER TABLE co_production.inquiries ADD CONSTRAINT "inquiries_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES co_production.contacts(id) ON DELETE SET NULL;
ALTER TABLE co_production.inquiries ADD CONSTRAINT "inquiries_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES co_production.organizations(id) ON DELETE SET NULL;
ALTER TABLE co_production.inquiries ADD CONSTRAINT "inquiries_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE co_production.inquiries ADD CONSTRAINT "inquiries_project_id_fkey" FOREIGN KEY (project_id) REFERENCES co_production.projects(id) ON DELETE SET NULL;
ALTER TABLE co_production.organizations ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE co_production.project_members ADD CONSTRAINT "project_members_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE co_production.project_members ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY (project_id) REFERENCES co_production.projects(id) ON DELETE CASCADE;
ALTER TABLE co_production.project_members ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE co_production.projects ADD CONSTRAINT "projects_organization_fk" FOREIGN KEY (organization_id) REFERENCES co_production.organizations(id) ON DELETE SET NULL;
ALTER TABLE co_production.projects ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE co_production.projects ADD CONSTRAINT "projects_primary_contact_fk" FOREIGN KEY (primary_contact_id) REFERENCES co_production.contacts(id) ON DELETE SET NULL;
ALTER TABLE co_production.projects ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY (team_id) REFERENCES co_production.teams(id) ON DELETE RESTRICT;
ALTER TABLE public.commercial_handoffs ADD CONSTRAINT "commercial_handoffs_estimate_id_fkey" FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE;
ALTER TABLE public.commercial_handoffs ADD CONSTRAINT "commercial_handoffs_estimate_version_id_fkey" FOREIGN KEY (estimate_version_id) REFERENCES estimate_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.estimate_versions ADD CONSTRAINT "estimate_versions_estimate_id_fkey" FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE;
ALTER TABLE public.estimates ADD CONSTRAINT "estimates_active_version_id_fkey" FOREIGN KEY (active_version_id) REFERENCES estimate_versions(id) ON DELETE SET NULL;
ALTER TABLE public.estimates ADD CONSTRAINT "estimates_brief_id_fkey" FOREIGN KEY (brief_id) REFERENCES creative_briefs(id) ON DELETE CASCADE;
ALTER TABLE public.estimates ADD CONSTRAINT "estimates_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.estimates ADD CONSTRAINT "estimates_legacy_quote_id_fkey" FOREIGN KEY (legacy_quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE public.estimates ADD CONSTRAINT "estimates_superseded_by_estimate_id_fkey" FOREIGN KEY (superseded_by_estimate_id) REFERENCES estimates(id) ON DELETE SET NULL;
ALTER TABLE public.estimate_decisions ADD CONSTRAINT "estimate_decisions_estimate_id_fkey" FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE;
ALTER TABLE public.estimate_decisions ADD CONSTRAINT "estimate_decisions_estimate_version_id_fkey" FOREIGN KEY (estimate_version_id) REFERENCES estimate_versions(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD CONSTRAINT "events_business_id_fkey" FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD CONSTRAINT "events_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT "projects_org_id_fkey" FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_contacts_org ON co_production.contacts USING btree (organization_id);
CREATE INDEX idx_deliverables_project ON co_production.deliverables USING btree (project_id, status);
CREATE INDEX idx_inquiries_cco_estimate ON co_production.inquiries USING btree (cco_estimate_id) WHERE (cco_estimate_id IS NOT NULL);
CREATE UNIQUE INDEX idx_inquiries_cco_estimate_version_unique ON co_production.inquiries USING btree (cco_estimate_version_id) WHERE (cco_estimate_version_id IS NOT NULL);
CREATE INDEX idx_inquiries_owner_status ON co_production.inquiries USING btree (owner_id, status);
CREATE INDEX project_members_user_idx ON co_production.project_members USING btree (user_id, project_id);
CREATE INDEX idx_projects_cco_estimate ON co_production.projects USING btree (cco_estimate_id) WHERE (cco_estimate_id IS NOT NULL);
CREATE UNIQUE INDEX idx_projects_cco_estimate_version_unique ON co_production.projects USING btree (cco_estimate_version_id) WHERE (cco_estimate_version_id IS NOT NULL);
CREATE INDEX projects_owner_updated_idx ON co_production.projects USING btree (owner_id, updated_at DESC);
CREATE INDEX projects_team_updated_idx ON co_production.projects USING btree (team_id, updated_at DESC);
CREATE INDEX idx_commercial_handoffs_estimate ON public.commercial_handoffs USING btree (estimate_id, created_at DESC);
CREATE INDEX idx_commercial_handoffs_version ON public.commercial_handoffs USING btree (estimate_version_id);
CREATE INDEX idx_briefs_company ON public.creative_briefs USING btree (company_account_id, created_at DESC);
CREATE INDEX idx_briefs_email ON public.creative_briefs USING btree (contact_email);
CREATE INDEX idx_briefs_phone ON public.creative_briefs USING btree (phone) WHERE (phone IS NOT NULL);
CREATE INDEX idx_briefs_status ON public.creative_briefs USING btree (status, created_at DESC);
CREATE INDEX idx_briefs_token ON public.creative_briefs USING btree (access_token);
CREATE UNIQUE INDEX idx_creative_briefs_brief_number ON public.creative_briefs USING btree (brief_number) WHERE (brief_number IS NOT NULL);
CREATE UNIQUE INDEX idx_creative_briefs_cco_public_submission_unique ON public.creative_briefs USING btree (((data ->> 'public_submission_id'::text))) WHERE ((company_account_id = 'content-co-op'::text) AND (data ? 'public_submission_id'::text));
CREATE INDEX idx_creative_briefs_source_surface ON public.creative_briefs USING btree (source_surface) WHERE (source_surface IS NOT NULL);
CREATE INDEX idx_creative_briefs_submission_mode ON public.creative_briefs USING btree (submission_mode) WHERE (submission_mode IS NOT NULL);
CREATE INDEX idx_estimate_versions_estimate ON public.estimate_versions USING btree (estimate_id, version DESC);
CREATE INDEX idx_estimates_active_version ON public.estimates USING btree (active_version_id) WHERE (active_version_id IS NOT NULL);
CREATE INDEX idx_estimates_brief ON public.estimates USING btree (brief_id, created_at DESC);
CREATE INDEX idx_estimates_client_status ON public.estimates USING btree (client_status, created_at DESC);
CREATE INDEX idx_estimates_contact ON public.estimates USING btree (contact_id, created_at DESC);
CREATE INDEX idx_estimates_internal_status ON public.estimates USING btree (internal_status, created_at DESC);
CREATE INDEX idx_estimates_legacy_quote ON public.estimates USING btree (legacy_quote_id) WHERE (legacy_quote_id IS NOT NULL);
CREATE UNIQUE INDEX idx_estimates_number ON public.estimates USING btree (estimate_number);
CREATE INDEX idx_estimate_decisions_estimate ON public.estimate_decisions USING btree (estimate_id, created_at DESC);
CREATE INDEX idx_estimate_decisions_version ON public.estimate_decisions USING btree (estimate_version_id) WHERE (estimate_version_id IS NOT NULL);
