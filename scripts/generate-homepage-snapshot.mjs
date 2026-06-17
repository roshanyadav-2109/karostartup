#!/usr/bin/env node
/**
 * Generate data/homepage.json — a static snapshot of the homepage's
 * slow-changing, article-LIST sections, so the public homepage can render
 * from one CDN-cached JSON file instead of firing ~40 PostgREST requests at
 * Supabase on every visit.
 *
 * WHY ANON KEY (not service role): the public homepage reads articles through
 * the anonymous, session-less Supabase client (sbPublic), so RLS hides the
 * auto-fetched PIB articles. This generator uses the SAME anon key so the
 * snapshot reproduces EXACTLY what an anonymous visitor would see — hidden PIB
 * stays hidden. Using the service-role key here would BYPASS RLS and leak
 * hidden PIB articles onto the homepage. Do not change this.
 *
 * The queries below MIRROR index.html's `cachedFetch('home:*', ...)` sections
 * 1:1 (same select columns, same filters, same order, same limits) so each
 * cached value is byte-for-byte what the live query would have returned. The
 * client picks `snapshot.data['home:<key>']`; anything missing/null falls back
 * to the live query (see assets/app.js `snap()`), so a partial or stale
 * snapshot degrades gracefully to today's behaviour — it is never a hard
 * dependency.
 *
 * SAFETY GUARD: the file is written ONLY if the critical `home:hero` query
 * returns a non-empty result (proof the DB is reachable and returning rows).
 * On any failure it leaves the previously committed data/homepage.json
 * untouched and exits 0, so a transient Supabase hiccup can never overwrite a
 * good snapshot with empty/broken data, and can never fail the Vercel build.
 *
 * Usage (local):  node scripts/generate-homepage-snapshot.mjs
 * Build (Vercel): wired via vercel.json buildCommand.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(REPO_ROOT, 'data');
const OUT_FILE = resolve(OUT_DIR, 'homepage.json');

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
// Public anon key (same one shipped in assets/app.js) — env override allowed.
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2d3B2cW1xbWlzb2ZmYm5uamRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODYyNTEsImV4cCI6MjA5NDI2MjI1MX0.ZYBWcOGiVKV9HM3Ho2GjJ-r4XJvMITvsEK7vlEFlzVw';

const HEADERS = { apikey: ANON, Authorization: `Bearer ${ANON}`, Accept: 'application/json' };

// ---- REST helper (anonymous; RLS applies) ----
async function rest(query, { wantCount = false } = {}) {
  const headers = wantCount ? { ...HEADERS, Prefer: 'count=exact' } : HEADERS;
  const r = await fetch(`${BASE}/rest/v1/${query}`, { headers });
  if (!r.ok) throw new Error(`${r.status} :: ${query.slice(0, 90)} :: ${(await r.text().catch(() => '')).slice(0, 120)}`);
  const data = await r.json();
  if (wantCount) {
    const cr = r.headers.get('content-range') || '';
    const total = cr.includes('/') ? parseInt(cr.split('/')[1], 10) : NaN;
    return { data, count: Number.isFinite(total) ? total : (Array.isArray(data) ? data.length : 0) };
  }
  return data;
}

const enc = encodeURIComponent;
const PUBLISHED = 'status=eq.published';

// ============================================================
// Section fetchers — each mirrors the matching index.html query.
// ============================================================

// home:hero — latest 14 published (lead + top stories + strip).
async function hero() {
  const select = 'id,slug,title,kicker,subtitle,summary,cover_image_url,published_at,read_time_minutes,is_featured,categories(name,slug),profiles!author_id(full_name)';
  return rest(`articles?select=${enc(select)}&${PUBLISHED}&order=published_at.desc,id.desc&limit=14`);
}

// home:picks — latest 6 'startups' features, excluding the hero lead.
async function picks(leadId) {
  const select = 'id,slug,title,kicker,subtitle,summary,cover_image_url,published_at,read_time_minutes,categories!inner(name,slug),profiles!author_id(full_name)';
  let q = `articles?select=${enc(select)}&${PUBLISHED}&categories.slug=eq.startups&order=published_at.desc&limit=6`;
  if (leadId) q += `&id=neq.${leadId}`;
  return rest(q);
}

// home:rotator — items 15..49 (skip the hero's 14) for the Latest News rail.
async function rotator() {
  const select = 'id,slug,title,kicker,cover_image_url,published_at,read_time_minutes,is_featured,categories(name,slug),profiles!author_id(full_name)';
  return rest(`articles?select=${enc(select)}&${PUBLISHED}&order=published_at.desc,id.desc&offset=14&limit=35`);
}

// home:rotator-ec — up to 6 editor's-choice stories.
async function rotatorEc() {
  const select = 'id,slug,title,kicker,cover_image_url,categories(name,slug)';
  return rest(`articles?select=${enc(select)}&${PUBLISHED}&is_editors_choice=eq.true&order=published_at.desc&limit=6`);
}

// home:sectors — for fintech/d2c/saas/ai: the category + its 3 latest stories.
async function sectors() {
  const slugs = ['fintech', 'd2c', 'saas', 'ai'];
  const cats = await rest(`categories?select=id,slug,name&slug=in.(${slugs.join(',')})`);
  return Promise.all(slugs.map(async (slug) => {
    const cat = (cats || []).find(c => c.slug === slug) || null;
    if (!cat) return { slug, cat: null, stories: [] };
    const stories = await rest(`articles?select=id,slug,title&${PUBLISHED}&category_id=eq.${cat.id}&order=published_at.desc&limit=3`);
    return { slug, cat, stories: stories || [] };
  }));
}

// home:founder — latest 'FOUNDER PROFILE' (maybeSingle → object|null).
async function founder() {
  const select = 'id,slug,title,summary,cover_image_url,kicker,profiles!author_id(full_name)';
  const rows = await rest(`articles?select=${enc(select)}&${PUBLISHED}&kicker=eq.${enc('FOUNDER PROFILE')}&order=published_at.desc&limit=1`);
  return (Array.isArray(rows) && rows[0]) || null;
}

// home:longreads — latest 3 deep-dive/analysis/research/roundup.
async function longreads() {
  const select = 'id,slug,title,kicker,summary,cover_image_url,published_at,categories(name)';
  const kickers = ['DEEP DIVE', 'ANALYSIS', 'RESEARCH', 'WEEKLY ROUNDUP'];
  const inList = kickers.map(k => enc(`"${k}"`)).join(',');
  return rest(`articles?select=${enc(select)}&${PUBLISHED}&kicker=in.(${inList})&order=published_at.desc&limit=3`);
}

// home:topics — top 6 categories by 30-day article count + latest cover.
async function topics() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const cats = await rest('categories?select=id,slug,name');
  if (!cats || !cats.length) return [];
  const enriched = await Promise.all(cats.map(async (c) => {
    const [{ count }, latest] = await Promise.all([
      rest(`articles?select=id&${PUBLISHED}&category_id=eq.${c.id}&published_at=gte.${enc(since)}&limit=1`, { wantCount: true }),
      rest(`articles?select=cover_image_url,title,slug&${PUBLISHED}&category_id=eq.${c.id}&order=published_at.desc&limit=1`),
    ]);
    return { ...c, count: count || 0, cover: latest?.[0]?.cover_image_url || null };
  }));
  enriched.sort((a, b) => b.count - a.count);
  return enriched.filter(t => t.count > 0).slice(0, 6);
}

// NOTE: shorts, podcasts, most-read, eminent and the markets widgets are
// deliberately NOT snapshotted — they change on their own cadence (markets
// every 5 min; shorts/podcasts via their own admin pages) and stay as live
// client queries so they never go stale. Only the slow-changing article-LIST
// sections below are snapshotted.

// ============================================================
// Orchestrate. Non-critical sections that fail are simply omitted
// (client falls back to live for those keys). Only `home:hero` is
// load-bearing — if it fails, we DON'T overwrite the existing file.
// ============================================================
(async () => {
  console.log('Generating homepage snapshot (anon key — RLS applies, PIB hidden)…');

  let heroData;
  try {
    heroData = await hero();
  } catch (e) {
    console.error(`  FATAL: home:hero query failed — ${e.message}`);
    if (existsSync(OUT_FILE)) console.error('  Keeping the existing data/homepage.json untouched.');
    else console.error('  No existing snapshot to keep; homepage will fall back to live queries.');
    process.exit(0); // never fail the build
  }
  if (!Array.isArray(heroData) || heroData.length === 0) {
    console.error('  FATAL: home:hero returned 0 rows — refusing to write an empty snapshot.');
    process.exit(0);
  }
  const lead = heroData.find(a => a.is_featured) || heroData[0];

  const data = { 'home:hero': heroData };

  // Each remaining section: best-effort. A failure logs a warning and is
  // omitted from the snapshot (that section goes live on the client).
  const jobs = [
    ['home:picks', () => picks(lead?.id)],
    ['home:rotator', rotator],
    ['home:rotator-ec', rotatorEc],
    ['home:sectors', sectors],
    ['home:founder', founder],
    ['home:longreads', longreads],
    ['home:topics', topics],
  ];
  await Promise.all(jobs.map(async ([key, fn]) => {
    try {
      const v = await fn();
      if (v !== undefined) data[key] = v;
    } catch (e) {
      console.warn(`  WARN: ${key} failed (${e.message}) — omitted; client will fetch it live.`);
    }
  }));

  const payload = { generatedAt: new Date().toISOString(), data };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(payload));

  const sizeKB = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1);
  console.log(`  wrote data/homepage.json (${sizeKB} KB)`);
  for (const [k, v] of Object.entries(data)) {
    const n = Array.isArray(v) ? `${v.length} rows` : (v == null ? 'null' : 'object');
    console.log(`    ${k.padEnd(18)} ${n}`);
  }
})().catch(e => { console.error('UNEXPECTED', e); process.exit(0); });
