-- ============================================================
-- KAROSTARTUP — eminent_readers table
-- ============================================================
-- Run this ONCE in the Supabase SQL editor. After it succeeds,
-- the seed script (scripts/seed-eminent-readers.mjs) can populate
-- and update rows via the service_role REST API.
--
-- The homepage reads from this table with the anon key — RLS
-- below permits SELECT for active rows to the public, and
-- INSERT / UPDATE / DELETE only to staff (author / editor / admin).
-- ============================================================

CREATE TABLE IF NOT EXISTS eminent_readers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  designation   text        NOT NULL,
  photo_url     text        NOT NULL,
  linkedin_url  text,
  twitter_url   text,
  instagram_url text,
  facebook_url  text,
  active        boolean     NOT NULL DEFAULT true,
  order_index   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eminent_readers_order_idx
  ON eminent_readers (order_index, created_at);

-- Bump updated_at on row updates
CREATE OR REPLACE FUNCTION public.touch_eminent_readers_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_eminent_readers_touch ON eminent_readers;
CREATE TRIGGER trg_eminent_readers_touch
  BEFORE UPDATE ON eminent_readers
  FOR EACH ROW EXECUTE FUNCTION public.touch_eminent_readers_updated_at();

-- RLS
ALTER TABLE eminent_readers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active eminent readers" ON eminent_readers;
CREATE POLICY "Public can read active eminent readers"
  ON eminent_readers FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "Staff can manage eminent readers" ON eminent_readers;
CREATE POLICY "Staff can manage eminent readers"
  ON eminent_readers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('author', 'editor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('author', 'editor', 'admin')
    )
  );
