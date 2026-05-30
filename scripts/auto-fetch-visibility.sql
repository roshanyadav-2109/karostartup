-- ============================================================================
-- Auto-fetch visibility control  (applied to the live Supabase project)
-- ============================================================================
-- Lets admins hide all auto-fetched (PIB) articles from the public site with a
-- single switch, while editors push individual ones live after fixing them.
--
-- Visibility is enforced at ONE place — the public SELECT RLS policy on
-- `articles` — so every public read path (homepage, search, category, direct
-- links, etc.) is covered without touching frontend queries. The generated
-- sitemap (scripts/generate-sitemap.mjs, service-role) mirrors the same logic.
--
-- Article classes:
--   pib    = auto-fetched PIB press releases  (slug '%-pib-%' AND tag 'pib')
--   legacy = one-time migrated from the old site (tag 'legacy')
--   manual = created in the admin editor
-- Only `pib` is gated by the toggle; legacy/manual are always visible.
--
-- Run order matters: the SELECT policy is swapped LAST, after `source` is fully
-- backfilled and NOT NULL, so there is never a window where the policy reads an
-- unpopulated column. This script is idempotent and safe to re-run.
-- ============================================================================

-- ---- Tx1: columns, functions, trigger, seed ------------------------------
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS approved_for_public boolean NOT NULL DEFAULT false;

-- Fail-closed: missing row / missing key / non-true value => FALSE (hide PIB).
CREATE OR REPLACE FUNCTION public.auto_fetch_public_visible()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    (SELECT value -> 'public_visible' = 'true'::jsonb
       FROM public.site_settings WHERE key = 'auto_fetch'),
    false);
$$;
GRANT EXECUTE ON FUNCTION public.auto_fetch_public_visible() TO anon, authenticated;

-- Auto-classify new rows (the PIB cron need not set `source`); never clobber an
-- explicit value (so the admin editor sending source='manual' is respected).
CREATE OR REPLACE FUNCTION public.set_article_source()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.source IS NOT NULL THEN RETURN NEW; END IF;
  NEW.source := CASE
    WHEN (NEW.slug LIKE '%-pib-%' AND NEW.tags @> ARRAY['pib']::text[]) THEN 'pib'
    WHEN NEW.tags @> ARRAY['legacy']::text[]                            THEN 'legacy'
    ELSE 'manual'
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_article_source ON public.articles;
CREATE TRIGGER trg_set_article_source
  BEFORE INSERT ON public.articles          -- INSERT only: don't reclassify edits
  FOR EACH ROW EXECUTE FUNCTION public.set_article_source();

-- Global toggle row. Ships OFF (auto-fetched articles hidden from the public).
INSERT INTO public.site_settings (key, value)
VALUES ('auto_fetch', '{"public_visible": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_articles_source_pib
  ON public.articles (published_at DESC) WHERE source = 'pib';
CREATE INDEX IF NOT EXISTS idx_articles_pub_source
  ON public.articles (status, source, published_at DESC);

-- ---- Tx2: backfill existing rows -----------------------------------------
UPDATE public.articles SET source = CASE
  WHEN (slug LIKE '%-pib-%' AND tags @> ARRAY['pib']::text[]) THEN 'pib'
  WHEN tags @> ARRAY['legacy']::text[]                        THEN 'legacy'
  ELSE 'manual'
END
WHERE source IS NULL;
-- expected distribution at time of writing: pib=258, legacy=1505, manual=3

-- ---- Tx3: lock column, swap the public SELECT policy ---------------------
-- IMPORTANT: do NOT give `source` a column DEFAULT. Postgres applies a column
-- default to the new row BEFORE the BEFORE INSERT trigger fires, which makes
-- NEW.source non-null and short-circuits set_article_source() — auto-fetched
-- (PIB) rows would then slip through classified as 'manual' and stay public.
-- The trigger always assigns a value, so NOT NULL is safe with no default.
ALTER TABLE public.articles
  ALTER COLUMN source SET NOT NULL;

-- NULL-safe (`IS DISTINCT FROM`): legacy/manual/NULL source always visible;
-- PIB visible only if individually approved or the global toggle is on; staff
-- always see everything (incl. drafts), matching the prior policy.
DROP POLICY IF EXISTS "Published articles viewable by everyone" ON public.articles;
DROP POLICY IF EXISTS "Public can read visible articles" ON public.articles;
CREATE POLICY "Public can read visible articles"
ON public.articles FOR SELECT
USING (
  public.is_staff(auth.uid())
  OR (
    status = 'published'
    AND (
      source IS DISTINCT FROM 'pib'
      OR approved_for_public
      OR public.auto_fetch_public_visible()
    )
  )
);

-- ============================================================================
-- ROLLBACK (instant behavioural revert — flip the toggle on, no deploy):
--   UPDATE public.site_settings SET value = '{"public_visible": true}'::jsonb
--   WHERE key = 'auto_fetch';
-- Full policy revert:
--   DROP POLICY "Public can read visible articles" ON public.articles;
--   CREATE POLICY "Published articles viewable by everyone" ON public.articles
--     FOR SELECT USING (status = 'published' OR public.is_staff(auth.uid()));
-- ============================================================================
