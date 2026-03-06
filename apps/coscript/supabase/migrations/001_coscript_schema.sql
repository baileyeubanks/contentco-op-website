-- Co-Script Schema — 7 tables + seeded frameworks
-- Run in Supabase SQL Editor

-- 1. Scripts (the core entity)
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Script',
  script_type TEXT NOT NULL DEFAULT 'video_script',
  content TEXT NOT NULL DEFAULT '',
  hook TEXT DEFAULT '',
  audience TEXT DEFAULT '',
  objective TEXT DEFAULT '',
  tone TEXT DEFAULT '',
  platform TEXT DEFAULT '',
  score INTEGER DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}',
  ai_feedback JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripts_user ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_status ON scripts(status);
CREATE INDEX IF NOT EXISTS idx_scripts_type ON scripts(script_type);

-- 2. Script Versions (auto-save history)
CREATE TABLE IF NOT EXISTS script_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  hook TEXT DEFAULT '',
  score INTEGER DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_versions_script ON script_versions(script_id);

-- 3. Frameworks (reusable script structures)
CREATE TABLE IF NOT EXISTS frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  structure JSONB NOT NULL DEFAULT '[]',
  example TEXT DEFAULT '',
  source TEXT DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_frameworks_category ON frameworks(category);

-- 4. Vault Items (swipe file / saved references)
CREATE TABLE IF NOT EXISTS vault_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  source_type TEXT DEFAULT 'manual',
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_user ON vault_items(user_id);

-- 5. Watchlists (creator/channel monitoring)
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'youtube',
  channel_url TEXT DEFAULT '',
  channel_id TEXT DEFAULT '',
  last_synced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user ON watchlists(user_id);

-- 6. Research Items (outliers / trending content found via watchlists)
CREATE TABLE IF NOT EXISTS research_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  watchlist_id UUID REFERENCES watchlists(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT DEFAULT '',
  platform TEXT DEFAULT 'youtube',
  view_count BIGINT DEFAULT 0,
  avg_views BIGINT DEFAULT 0,
  outlier_score NUMERIC(5,2) DEFAULT 0,
  thumbnail_url TEXT DEFAULT '',
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_user ON research_items(user_id);
CREATE INDEX IF NOT EXISTS idx_research_outlier ON research_items(outlier_score DESC);

-- 7. Share Links
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_token ON share_links(token);

-- Updated-at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scripts_updated ON scripts;
CREATE TRIGGER trg_scripts_updated BEFORE UPDATE ON scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Scripts: owner access
CREATE POLICY scripts_owner ON scripts FOR ALL USING (auth.uid() = user_id);

-- Versions: owner via script
CREATE POLICY versions_owner ON script_versions FOR ALL
  USING (EXISTS (SELECT 1 FROM scripts WHERE scripts.id = script_versions.script_id AND scripts.user_id = auth.uid()));

-- Frameworks: system ones readable by all, user ones by owner
CREATE POLICY frameworks_read ON frameworks FOR SELECT
  USING (is_system = true OR auth.uid() = user_id);
CREATE POLICY frameworks_write ON frameworks FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_system = false);
CREATE POLICY frameworks_update ON frameworks FOR UPDATE
  USING (auth.uid() = user_id AND is_system = false);
CREATE POLICY frameworks_delete ON frameworks FOR DELETE
  USING (auth.uid() = user_id AND is_system = false);

-- Vault: owner access
CREATE POLICY vault_owner ON vault_items FOR ALL USING (auth.uid() = user_id);

-- Watchlists: owner access
CREATE POLICY watchlists_owner ON watchlists FOR ALL USING (auth.uid() = user_id);

-- Research: owner access
CREATE POLICY research_owner ON research_items FOR ALL USING (auth.uid() = user_id);

-- Share links: owner via script
CREATE POLICY share_owner ON share_links FOR ALL
  USING (EXISTS (SELECT 1 FROM scripts WHERE scripts.id = share_links.script_id AND scripts.user_id = auth.uid()));
-- Public read for valid share tokens (used by shared view)
CREATE POLICY share_public_read ON share_links FOR SELECT USING (true);

-- Seed 12 system frameworks
INSERT INTO frameworks (name, category, description, structure, example, source, is_system) VALUES
(
  'The Hook → Story → Offer',
  'hooks',
  'Classic Hormozi framework: grab attention, tell a relatable story, present the offer as the solution.',
  '["Hook: Pattern interrupt or bold claim", "Story: Relatable struggle or transformation", "Offer: Clear CTA with value stack"]',
  'What if I told you your morning routine is costing you $10K/month? [Story about discovery] Here''s the exact system...',
  'Alex Hormozi',
  true
),
(
  'The Curiosity Gap',
  'hooks',
  'Open a loop the viewer MUST close. Tease the outcome without revealing the method.',
  '["Tease: Hint at surprising result", "Context: Why this matters", "Payoff: Deliver the insight"]',
  'I made $100K in 30 days using a strategy nobody talks about...',
  'Kallaway / MrBeast',
  true
),
(
  'The Contrarian Take',
  'hooks',
  'Challenge conventional wisdom. State something most people believe, then demolish it.',
  '["Conventional belief statement", "Why it''s wrong", "The real truth + evidence"]',
  'Everyone says you need to post daily. They''re wrong. Here''s why posting less actually grew my audience 3x...',
  'Kallaway',
  true
),
(
  'The Before/After Bridge',
  'hooks',
  'Show the painful before, paint the dream after, then reveal the bridge.',
  '["Before: Current pain state", "After: Dream outcome", "Bridge: Your solution"]',
  'Before: Spending 4 hours writing one post. After: 10 posts in 30 minutes. Here''s the bridge...',
  'Alex Hormozi',
  true
),
(
  'The List Attack',
  'hooks',
  'Promise a specific number of actionable items. Numbers create commitment.',
  '["Number promise in hook", "Rapid-fire items with micro-proof", "Recap + CTA"]',
  '7 things I''d do if I were starting from zero in 2026...',
  'General',
  true
),
(
  'The Story Loop',
  'hooks',
  'Start in the middle of a dramatic moment, rewind, then pay off.',
  '["Cold open: dramatic mid-point", "Rewind: how we got here", "Resolution + lesson"]',
  'The client called at 2am. "It''s all gone." Let me rewind 48 hours...',
  'Kallaway',
  true
),
(
  'PAS (Problem-Agitate-Solution)',
  'frameworks',
  'Classic copywriting framework. Name the problem, twist the knife, present the cure.',
  '["Problem: Name the pain clearly", "Agitate: Make it feel urgent/worse", "Solution: Present your answer"]',
  'Struggling to get views? Every day you post without a system, you''re training the algorithm to ignore you. Here''s the fix...',
  'Dan Kennedy',
  true
),
(
  'AIDA (Attention-Interest-Desire-Action)',
  'frameworks',
  'Time-tested marketing framework adapted for short-form content.',
  '["Attention: Bold hook or visual", "Interest: Relevant detail or stat", "Desire: Emotional benefit", "Action: Clear CTA"]',
  '[Attention] 97% of content fails in the first 3 seconds. [Interest] I studied 1,000 viral videos... [Desire] Imagine never worrying about hooks again. [Action] Save this framework.',
  'Classic Marketing',
  true
),
(
  'The Authority Stack',
  'frameworks',
  'Lead with credentials, deliver massive value, then soft-pitch.',
  '["Authority proof (results/credentials)", "Value delivery (3-5 insights)", "Soft CTA"]',
  'After scaling 47 brands past $1M, here are the 3 things they all have in common...',
  'Alex Hormozi',
  true
),
(
  'The Myth Buster',
  'frameworks',
  'List common myths in your niche and demolish each one with data.',
  '["Myth statement", "Why people believe it", "The truth + proof", "Repeat for each myth"]',
  'Myth: You need 10K followers to monetize. Truth: I made my first $5K with 847 followers. Here''s how...',
  'General',
  true
),
(
  'The Tutorial Formula',
  'frameworks',
  'Step-by-step how-to with clear outcomes at each stage.',
  '["Result promise", "Step 1 (quick win)", "Step 2 (core method)", "Step 3 (optimization)", "Recap result"]',
  'How to write a script in 5 minutes that sounds like you spent 5 hours...',
  'General',
  true
),
(
  'The Emotional Rollercoaster',
  'frameworks',
  'Alternate between tension and relief to keep viewers engaged throughout.',
  '["High tension open", "Moment of relief/humor", "Escalate tension", "Satisfying resolution", "Emotional CTA"]',
  'I almost quit last month. Then THIS happened... [tension] But wait, it got worse... [relief] Until I realized...',
  'Kallaway',
  true
)
ON CONFLICT DO NOTHING;
