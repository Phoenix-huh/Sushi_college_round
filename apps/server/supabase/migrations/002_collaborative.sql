-- Migration 002: Collaborative Editing & Conflict Detection

-- Sites table
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  live_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Patch Ops table
CREATE TABLE IF NOT EXISTS patch_ops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id UUID NOT NULL REFERENCES patches(id) ON DELETE CASCADE,
  anchors JSONB NOT NULL,
  property TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id UUID NOT NULL REFERENCES patches(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conflicts table
CREATE TABLE IF NOT EXISTS conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_a UUID NOT NULL REFERENCES patches(id) ON DELETE CASCADE,
  patch_b UUID NOT NULL REFERENCES patches(id) ON DELETE CASCADE,
  op_a UUID,
  op_b UUID,
  type TEXT NOT NULL CHECK (type IN ('concurrent', 'stale_base', 'semantic')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alter patches table: add site_id, title, and update status constraint
ALTER TABLE patches ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE patches ADD COLUMN IF NOT EXISTS title TEXT;

-- Drop and recreate the status constraint to support new statuses
ALTER TABLE patches DROP CONSTRAINT IF EXISTS patches_status_check;
ALTER TABLE patches ADD CONSTRAINT patches_status_check CHECK (
  status IN ('draft', 'in_review', 'approved', 'live', 'conflicted', 'rejected', 'stale', 'broken', 'healed')
);

-- Alter versions table: add parent_id, ops_snapshot
ALTER TABLE versions ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES versions(id) ON DELETE SET NULL;
ALTER TABLE versions ADD COLUMN IF NOT EXISTS ops_snapshot JSONB DEFAULT '[]'::jsonb;

-- Foreign key on sites.live_version_id -> versions(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_sites_live_version'
  ) THEN
    ALTER TABLE sites ADD CONSTRAINT fk_sites_live_version FOREIGN KEY (live_version_id) REFERENCES versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patch_ops_patch ON patch_ops(patch_id);
CREATE INDEX IF NOT EXISTS idx_reviews_patch ON reviews(patch_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
CREATE INDEX IF NOT EXISTS idx_conflicts_patch_a ON conflicts(patch_a);
CREATE INDEX IF NOT EXISTS idx_conflicts_patch_b ON conflicts(patch_b);
CREATE INDEX IF NOT EXISTS idx_sites_url ON sites(url);

-- RLS
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE patch_ops ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sites" ON sites FOR SELECT USING (true);
CREATE POLICY "Public insert sites" ON sites FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sites" ON sites FOR UPDATE USING (true);
CREATE POLICY "Public delete sites" ON sites FOR DELETE USING (true);

CREATE POLICY "Public read patch_ops" ON patch_ops FOR SELECT USING (true);
CREATE POLICY "Public insert patch_ops" ON patch_ops FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update patch_ops" ON patch_ops FOR UPDATE USING (true);
CREATE POLICY "Public delete patch_ops" ON patch_ops FOR DELETE USING (true);

CREATE POLICY "Public read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Public insert reviews" ON reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update reviews" ON reviews FOR UPDATE USING (true);
CREATE POLICY "Public delete reviews" ON reviews FOR DELETE USING (true);

CREATE POLICY "Public read conflicts" ON conflicts FOR SELECT USING (true);
CREATE POLICY "Public insert conflicts" ON conflicts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update conflicts" ON conflicts FOR UPDATE USING (true);
CREATE POLICY "Public delete conflicts" ON conflicts FOR DELETE USING (true);
