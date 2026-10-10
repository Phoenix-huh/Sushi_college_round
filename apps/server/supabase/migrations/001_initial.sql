-- Enable pgcrypto / uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('developer', 'reviewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Patches table
CREATE TABLE IF NOT EXISTS patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url TEXT NOT NULL,
  base_version INTEGER NOT NULL DEFAULT 0,
  anchors JSONB NOT NULL,
  change JSONB NOT NULL,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'live', 'broken', 'healed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Versions table
CREATE TABLE IF NOT EXISTS versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  patch_ids UUID[] NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'passed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deployments table
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  is_live BOOLEAN NOT NULL DEFAULT false,
  canary_percent INTEGER NOT NULL DEFAULT 100 CHECK (canary_percent >= 0 AND canary_percent <= 100),
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rolled_back_at TIMESTAMPTZ
);

-- Audit events table
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  event_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patches_status ON patches(status);
CREATE INDEX IF NOT EXISTS idx_patches_author ON patches(author_id);
CREATE INDEX IF NOT EXISTS idx_patches_url ON patches(target_url);
CREATE INDEX IF NOT EXISTS idx_deployments_live ON deployments(is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patches ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Permissive policies for demo & dashboard access
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Public insert profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update profiles" ON profiles FOR UPDATE USING (true);
CREATE POLICY "Public delete profiles" ON profiles FOR DELETE USING (true);

CREATE POLICY "Public read patches" ON patches FOR SELECT USING (true);
CREATE POLICY "Public insert patches" ON patches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update patches" ON patches FOR UPDATE USING (true);
CREATE POLICY "Public delete patches" ON patches FOR DELETE USING (true);

CREATE POLICY "Public read versions" ON versions FOR SELECT USING (true);
CREATE POLICY "Public insert versions" ON versions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update versions" ON versions FOR UPDATE USING (true);
CREATE POLICY "Public delete versions" ON versions FOR DELETE USING (true);

CREATE POLICY "Public read deployments" ON deployments FOR SELECT USING (true);
CREATE POLICY "Public insert deployments" ON deployments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update deployments" ON deployments FOR UPDATE USING (true);
CREATE POLICY "Public delete deployments" ON deployments FOR DELETE USING (true);

CREATE POLICY "Public read audit_events" ON audit_events FOR SELECT USING (true);
CREATE POLICY "Public insert audit_events" ON audit_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete audit_events" ON audit_events FOR DELETE USING (true);

-- Enable Realtime publications
ALTER PUBLICATION supabase_realtime ADD TABLE patches;
ALTER PUBLICATION supabase_realtime ADD TABLE deployments;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_events;
