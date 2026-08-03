---
title: Database Schema
created: 2026-04-30
updated: 2026-05-01
tags: [database, supabase, schema, ontology]
---

## Summary

Content Co-op uses Supabase as its primary database. The schema is managed through SQL migrations in `infra/supabase/migrations/`. The CCO OS ontology (added in `20260317_root_ontology_core.sql`) provides the canonical data model for CRM, projects, and finance.

## Migrations

| File | Purpose |
|------|---------|
| `20260224_content_coop_v21.sql` | Base schema |
| `20260225_acs_v1.sql` | ACS integration |
| `20260225_job_applicants.sql` | Job applicants |
| `20260225_onboarding_v1.sql` | User onboarding |
| `20260226_add_contact_fields.sql` | Contact field expansion |
| `20260226_coedit_v2.sql` | Co-Edit schema |
| `20260226_user_profiles.sql` | User profiles |
| `20260306_root_ops_core.sql` | Work claims, handoffs, document artifacts |
| `20260317_creative_brief_v3_structured_fields.sql` | Structured brief columns |
| `20260317_root_ontology_core.sql` | **Full CCO OS ontology** |
| `20260411_root_commercial_pipeline.sql` | Commercial pipeline extensions |

## Core Tables

### Foundation

| Table | Purpose |
|-------|---------|
| `businesses` | Business units (CC, ACS) |
| `contacts` | People/Contacts |
| `events` | Event stream |
| `quotes` / `quote_items` | Quotes and line items |
| `invoices` / `invoice_payments` | Invoices and payments |
| `contact_business_map` | Multi-business contact junction |

### Ontology Layer

| Table | Purpose |
|-------|---------|
| `companies` | Normalized company records |
| `relationships` | Typed contact↔company connections |
| `opportunities` | Deal pipeline |
| `projects` | Project tracking |
| `deliverables` | Creative assets |
| `campaigns` / `campaign_contacts` | Marketing campaigns |
| `payments` | Payment ledger |
| `catalog_items` | Product/service catalog |
| `automation_rules` / `automation_runs` | Declarative automation |

### Operations

| Table | Purpose |
|-------|---------|
| `work_claims` | Task claiming |
| `daily_handoffs` | Daily handoff logs |
| `document_artifacts` | Rendered documents |

### Creative Briefs

| Column | Type | Purpose |
|--------|------|---------|
| `contact_name`, `contact_email`, `phone`, `company`, `role`, `location` | text | Basic contact info |
| `content_type`, `deliverables`, `audience`, `tone`, `deadline` | text | Project details |
| `objective`, `key_messages`, `references`, `constraints` | text | Creative direction |
| `booking_intent` | text | Structured booking signal |
| `source_surface`, `source_path`, `submission_mode` | text | Attribution |
| `intake_payload` | jsonb | Raw intake data |
| `structured_intake` | jsonb | Normalized intake |
| `handoff_payload` | jsonb | Handoff envelope |

## Row Level Security (RLS)

All tables have RLS enabled. Policies restrict access based on:
- `auth.uid()` for authenticated users
- Business unit membership via `contact_business_map`
- CCO OS role via `root_users` table

## Related

- [[types-system]] — TypeScript types matching schema
- [[firebase-integration]] — Firestore collections (parallel data)
- [[api-routes]] — API layer over schema
