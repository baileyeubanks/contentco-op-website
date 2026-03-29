-- Migration: 20260225_job_applicants.sql
-- Creates job_applicants table for ACS resume/application triage
-- Populated by gmail_monitor.py monitoring caio@astrocleanings.com
-- Proactive alerts via acs_proactive.py → @AgentAstro_bot → Caio

CREATE TABLE IF NOT EXISTS public.job_applicants (
    id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id      uuid,
    name             text NOT NULL,
    email            text NOT NULL,
    phone            text,
    position         text DEFAULT 'Crew Member',
    application_text text,
    source           text DEFAULT 'email',    -- indeed | ziprecruiter | linkedin | email
    status           text DEFAULT 'pending',  -- pending | reviewing | accepted | rejected
    gmail_message_id text UNIQUE,
    metadata         jsonb DEFAULT '{}',
    reviewed_by      text,
    reviewed_at      timestamptz,
    created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ja_status   ON public.job_applicants(status);
CREATE INDEX IF NOT EXISTS idx_ja_business ON public.job_applicants(business_id);
CREATE INDEX IF NOT EXISTS idx_ja_created  ON public.job_applicants(created_at DESC);

ALTER TABLE public.job_applicants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.job_applicants
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.job_applicants IS
    'Job applications captured from caio@astrocleanings.com via gmail_monitor. Status: pending → reviewing → accepted/rejected.';
