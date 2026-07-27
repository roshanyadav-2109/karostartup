#!/usr/bin/env node
/**
 * Ingest the NewsReach syndicated press-release RSS feed into `articles`.
 *
 * Runs hourly from .github/workflows/newsreach.yml. New items are published live
 * under a dedicated "Press Releases" category, bylined to the Karostartup house
 * profile, labelled "PRESS RELEASE" (as our Editorial Policy requires), and
 * marked source='newsreach' so they can always be filtered or pulled later.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=ey... [NEWSREACH_FEED_URL=...] node scripts/fetch-newsreach.mjs
 *   node scripts/fetch-newsreach.mjs --dry-run     # parse only, no DB, no key needed
 *
 * Dedupe: by slug (slugified title). An item whose slug already exists is skipped,
 * so re-runs are idempotent and the 50-item feed window never creates duplicates.
 */

const DRY = process.argv.includes('--dry-run');
const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const REST = `${BASE}/rest/v1`;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FEED = process.env.NEWSREACH_FEED_URL || 'https://feed.newsreach.in/ZDBmZTFEdGxCT3RyTXBTMnVPRGhzZz09';
const HOUSE_BYLINE = '818e4c06-46d6-4c3a-b3b3-5b261479c9c9'; // "Karostartup" house profile
const CATEGORY = { slug: 'press-releases', name: 'Press Releases', description: 'Company announcements and syndicated press releases from across India’s business ecosystem.' };

if (!DRY && !KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY (or pass --dry-run)'); process.exit(1); }

const H = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' });

// ---------- parsing helpers ----------
function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&lsquo;|&rsquo;/g, "'");
}
function cdata(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  const inner = m[1].trim();
  const cd = inner.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return (cd ? cd[1] : inner).trim();
}
function attrUrl(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*\\burl="([^"]+)"`, 'i'));
  return m ? m[1] : '';
}

// Strip the same Office/Word paste cruft we clean elsewhere, PLUS inline styling
// so PR bodies inherit the site's article typography instead of Calibri/colours.
function cleanBody(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<xml[\s\S]*?<\/xml>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?[ovw]:[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/\sstyle="[^"]*"/gi, '')          // drop inline styles
    .replace(/\s(?:class|dir|lang|align)="[^"]*"/gi, '')
    .replace(/<span>\s*<\/span>/gi, '')
    .replace(/<span>/gi, '').replace(/<\/span>/gi, '') // unwrap now-bare spans
    .replace(/<p>\s*(?:&nbsp;|\s)*<\/p>/gi, '') // drop empty paragraphs
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function plainText(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function slugify(s) {
  return plainText(s).toLowerCase()
    .replace(/['’".,:;!?()\[\]{}]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120).replace(/-+$/g, '');
}
// "27-07-2026 11:52 AM" -> ISO
function parseDate(s) {
  const m = String(s || '').match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let [, dd, mm, yyyy, hh, min, ap] = m;
  hh = parseInt(hh, 10);
  if (ap) { const up = ap.toUpperCase(); if (up === 'PM' && hh < 12) hh += 12; if (up === 'AM' && hh === 12) hh = 0; }
  // Feed times are IST (+05:30)
  return `${yyyy}-${mm}-${dd}T${String(hh).padStart(2, '0')}:${min}:00+05:30`;
}

async function rest(path, opts = {}) {
  const r = await fetch(`${REST}/${path}`, { headers: H(), ...opts });
  if (!r.ok && r.status !== 201 && r.status !== 200 && r.status !== 206) {
    throw new Error(`${opts.method || 'GET'} ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function ensureCategory() {
  if (DRY) return '(dry-run-category-id)';
  const existing = await rest(`categories?slug=eq.${CATEGORY.slug}&select=id&limit=1`);
  if (existing && existing[0]) return existing[0].id;
  const created = await rest('categories', {
    method: 'POST',
    headers: { ...H(), Prefer: 'return=representation' },
    body: JSON.stringify({ slug: CATEGORY.slug, name: CATEGORY.name, description: CATEGORY.description, order_index: 99, color: '#d10a11' }),
  });
  console.log(`  created "Press Releases" category: ${created[0].id}`);
  return created[0].id;
}

async function slugExists(slug) {
  const rows = await rest(`articles?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`);
  return Array.isArray(rows) && rows.length > 0;
}

(async () => {
  console.log(`Fetching NewsReach feed${DRY ? ' (DRY RUN — no DB writes)' : ''}…`);
  const r = await fetch(FEED, { headers: { 'user-agent': 'KarostartupBot/1.0 (+https://www.karostartup.com)' } });
  if (!r.ok) { console.error(`feed fetch failed: ${r.status}`); process.exit(1); }
  const xml = await r.text();
  const items = xml.split('<item>').slice(1).map((s) => s.slice(0, s.indexOf('</item>')));
  console.log(`  ${items.length} items in feed`);

  const categoryId = await ensureCategory();

  let inserted = 0, skipped = 0, failed = 0;
  const seenThisRun = new Set(); // guard 1: collapse in-feed duplicates (NewsReach re-posts the same release under a new order id) before any DB call
  for (const block of items) {
    const title = decodeEntities(cdata(block, 'title'));
    if (!title) { skipped++; continue; }
    const slug = slugify(title);
    if (!slug) { skipped++; continue; }
    if (seenThisRun.has(slug)) { skipped++; continue; }
    seenThisRun.add(slug);
    const image = attrUrl(block, 'enclosure') || attrUrl(block, 'link');
    const rawBody = cdata(block, 'description');
    const content = cleanBody(rawBody);
    const summary = plainText(content).slice(0, 300);
    const words = plainText(content).split(' ').filter(Boolean).length;
    const publishedAt = parseDate(cdata(block, 'pubdate')) || new Date().toISOString();

    const row = {
      slug, title,
      kicker: 'PRESS RELEASE',
      summary,
      content,
      cover_image_url: image || null,
      author_id: HOUSE_BYLINE,
      category_id: categoryId,
      tags: ['Press Release'],
      status: 'published',
      source: 'newsreach',
      approved_for_public: true,
      ai_summarized: false,
      is_featured: false, is_breaking: false, is_premium: false, is_exclusive: false,
      read_time_minutes: Math.max(1, Math.round(words / 200)),
      published_at: publishedAt,
    };

    if (DRY) {
      console.log(`  [new] ${slug}\n        title: ${title.slice(0, 70)}\n        img:${image ? 'y' : 'n'} words:${words} read:${row.read_time_minutes}m pub:${publishedAt}`);
      inserted++;
      continue;
    }
    try {
      if (await slugExists(slug)) { skipped++; continue; }        // guard 2: already imported in a previous run
      await rest('articles', { method: 'POST', headers: { ...H(), Prefer: 'return=minimal' }, body: JSON.stringify(row) });
      inserted++;
      console.log(`  + ${slug}`);
    } catch (e) {
      // guard 3: if a unique-slug constraint rejects it (409/23505), that's a
      // duplicate we raced with — count as skipped, not a failure.
      if (/\b409\b|23505|duplicate key/i.test(e.message)) { skipped++; }
      else { failed++; console.error(`  ! ${slug}: ${e.message}`); }
    }
  }
  console.log(`\nDone. new:${inserted} skipped(existing):${skipped} failed:${failed}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
