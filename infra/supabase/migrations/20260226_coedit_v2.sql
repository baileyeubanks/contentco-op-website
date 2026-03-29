-- Co-Edit v2: AI-enhanced interview editing
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/briokwdoonawhxisbydy/sql/new

CREATE TABLE IF NOT EXISTS editing_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raw_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES editing_projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_url TEXT,
  duration_seconds NUMERIC,
  file_size_bytes BIGINT,
  mime_type TEXT DEFAULT 'video/mp4',
  status TEXT NOT NULL DEFAULT 'uploaded',
  transcript_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS soundbites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES raw_uploads(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES editing_projects(id) ON DELETE CASCADE,
  start_tc TEXT NOT NULL,
  end_tc TEXT NOT NULL,
  duration_seconds NUMERIC,
  transcript TEXT NOT NULL,
  speaker TEXT,
  category TEXT,
  confidence NUMERIC,
  tags TEXT[] DEFAULT '{}',
  keeper BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES editing_projects(id) ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES raw_uploads(id),
  status TEXT NOT NULL DEFAULT 'queued',
  soundbites_found INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
