#!/usr/bin/env node
/**
 * Seed Karostartup with real, today-dated press releases from the
 * Government of India sources that are explicitly free to republish:
 *
 *   - PIB (Press Information Bureau) — English national releases
 *     across Finance, Corporate Affairs, Commerce, MSME, Niti Aayog,
 *     Industry & Internal Trade, Power, Petroleum, Steel, Mines, etc.
 *
 * Pulls the latest list, filters to business/economy ministries, fetches
 * each detail page, parses title + subtitle + ministry + post date +
 * full body, and inserts into the `articles` table with the actual
 * publication timestamp. Newest item becomes is_featured + is_breaking;
 * the next two become is_breaking. Idempotent on slug.
 *
 * Modes:
 *   - LIVE (default): fetches the top of PIB's English listing
 *     (~30-40 newest releases). Cheap, runs in <1 min, designed for cron.
 *
 *   - BACKFILL: sweeps PRIDs in a range to seed historical data.
 *       BACKFILL_FROM=2026-01-01 [BACKFILL_TO=2026-05-14] \
 *         node scripts/seed-press-releases.mjs
 *     Estimates the start PRID, walks forward, keeps only items whose
 *     parsed post-date falls in the requested window. Idempotent on
 *     slug (re-runs safely skip what's already in the DB). Expect this
 *     to take several hours for a multi-month window — run it locally
 *     once, then let the 30-min cron keep things fresh going forward.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/seed-press-releases.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=ey... BACKFILL_FROM=2026-01-01 \
 *     node scripts/seed-press-releases.mjs
 *
 * Recommended cron: every 30 minutes (.github/workflows/seed-press-releases.yml)
 */

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; KarostartupBot/1.0)' };

// -- Supabase REST helpers --------------------------------------------------
async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path}: ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}
const upsert = (table, rows, onConflict) => rest(`${table}?on_conflict=${onConflict}`, {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify(rows),
});

// -- HTML helpers -----------------------------------------------------------
function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function slugify(s, suffix) {
  const base = s.toLowerCase()
    .replace(/&[a-z]+;/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return suffix ? `${base}-${suffix}` : base;
}

// PIB date string e.g. "14 MAY 2026  10:27AM" → ISO. Falls back to now.
function parsePibDate(raw) {
  if (!raw) return new Date().toISOString();
  const m = raw.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})(AM|PM)/i);
  if (!m) return new Date().toISOString();
  const months = { JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5, JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 };
  const [, d, mon, y, hh, mm, ap] = m;
  let h = Number(hh) % 12;
  if (ap.toUpperCase() === 'PM') h += 12;
  // PIB times are IST (+05:30). Convert to UTC ISO.
  const ist = new Date(Date.UTC(Number(y), months[mon.toUpperCase()], Number(d), h, Number(mm)));
  ist.setUTCMinutes(ist.getUTCMinutes() - 330);
  return ist.toISOString();
}

// -- Ministry → category mapping -------------------------------------------
// Maps each PIB-issuing ministry to one of our category slugs. Anything
// not in the map is dropped so we only surface business-relevant items.
const MINISTRY_TO_CATEGORY = {
  // Finance / monetary / tax / fiscal
  'Ministry of Finance':                              'banking',
  'Ministry of Corporate Affairs':                    'markets',
  'Ministry of Statistics & Programme Implementation':'markets',
  // Industry / commerce
  'Ministry of Commerce & Industry':                  'policy',
  'Department for Promotion of Industry and Internal Trade': 'policy',
  'Ministry of Micro, Small & Medium Enterprises':    'policy',
  'Ministry of Heavy Industries':                     'policy',
  // Tech / digital / startups
  'Ministry of Electronics & IT':                     'ai',
  'Ministry of Communications':                       'policy',
  'Ministry of Information & Broadcasting':           'policy',
  // Infra / sectors
  'Ministry of Power':                                'climate',
  'Ministry of New and Renewable Energy':             'climate',
  'Ministry of Petroleum & Natural Gas':              'climate',
  'Ministry of Coal':                                 'climate',
  'Ministry of Mines':                                'policy',
  'Ministry of Steel':                                'policy',
  'Ministry of Railways':                             'policy',
  'Ministry of Civil Aviation':                       'policy',
  'Ministry of Shipping':                             'policy',
  'Ministry of Road Transport & Highways':            'policy',
  'Ministry of Housing & Urban Affairs':              'policy',
  // Niti, planning, economic advisory
  'NITI Aayog':                                       'policy',
  'PIB Headquarters':                                 'policy',
  // Cooperation / agri-economy
  'Ministry of Cooperation':                          'policy',
  'Ministry of Agriculture & Farmers Welfare':        'policy',
  'Ministry of Consumer Affairs, Food & Public Distribution': 'policy',
  'Ministry of Food Processing Industries':           'd2c',
  'Ministry of Textiles':                             'd2c',
};

// Cover images by category slug (Unsplash, public).
const COVER_BY_CATEGORY = {
  banking:  'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1600&q=80',
  markets:  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&q=80',
  policy:   'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1600&q=80',
  ai:       'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1600&q=80',
  climate:  'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=1600&q=80',
  d2c:      'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=1600&q=80',
  fintech:  'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?w=1600&q=80',
  saas:     'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&q=80',
};

// -- PIB fetchers -----------------------------------------------------------
async function pibListing() {
  const url = 'https://pib.gov.in/AllRel.aspx?Reg=3&Lang=1';
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`PIB list: ${res.status}`);
  const html = await res.text();
  const matches = [...html.matchAll(/PressReleasePage\.aspx\?PRID=(\d+)/g)];
  // De-dupe, preserve order (newest first on the listing page)
  return [...new Set(matches.map(m => m[1]))];
}

async function pibDetail(prid) {
  const url = `https://pib.gov.in/PressReleasePage.aspx?PRID=${prid}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`PIB detail ${prid}: ${res.status}`);
  const html = await res.text();

  const titleM    = html.match(/<h2[^>]*id="Titleh2"[^>]*>([\s\S]*?)<\/h2>/i);
  const subtitleM = html.match(/<span[^>]*id="ltrSubtitle"[^>]*>([\s\S]*?)<\/span>/i);
  const ministryM = html.match(/<div[^>]*id="MinistryName"[^>]*>([\s\S]*?)<\/div>/i);
  const dateM     = html.match(/<div[^>]*id="PrDateTime"[^>]*>([\s\S]*?)<\/div>/i);

  if (!titleM || !ministryM) return null;

  const title    = stripTags(titleM[1]);
  const subtitle = subtitleM ? stripTags(subtitleM[1]) : '';
  const ministry = stripTags(ministryM[1]);
  const dateRaw  = dateM ? stripTags(dateM[1]).replace(/^Posted\s+On:\s*/i, '') : '';

  // Body: paragraphs inside the right content block, before the share-tab.
  // Slice from where the post-date ends to the share/tail markers.
  const idxStart = html.indexOf('id="PrDateTime"');
  const idxEnd   = Math.min(
    ...['social_share', 'share-tab', 'PdfDiv', 'related-data', 'PIB Delhi', 'PIB Mumbai']
      .map(s => { const i = html.indexOf(s, idxStart + 200); return i < 0 ? Infinity : i; }),
  );
  const bodyHtml = idxStart >= 0 && Number.isFinite(idxEnd)
    ? html.slice(idxStart, idxEnd)
    : html;
  let body = stripTags(bodyHtml);

  // Remove the date prefix and ministry boilerplate that always leads.
  body = body.replace(/^[\s\S]*?(AM|PM)\s*by\s+PIB[^\n]*\n+/i, '').trim();
  // Strip residual "*****" or release codes at the bottom
  body = body.replace(/\*{3,}[\s\S]*$/, '').trim();
  body = body.replace(/\([A-Z]{2,5}\/[A-Z]{2,5}\/[A-Z]{2,5}\)[\s\S]*$/m, '').trim();

  return {
    prid,
    title,
    subtitle,
    ministry,
    publishedAt: parsePibDate(dateRaw),
    body,
    source: 'PIB',
  };
}

// -- Main pipeline ---------------------------------------------------------
async function ensureCategories() {
  // Add the press-release-friendly categories we map to. Existing ones
  // (fintech, saas, d2c, ai, climate, policy) are left untouched.
  const cats = [
    { slug: 'banking', name: 'Banking',
      description: 'Monetary policy, RBI moves, and the rails of Indian finance.',
      color: '#0b5394', order_index: 7 },
    { slug: 'markets', name: 'Markets',
      description: 'IPOs, SEBI rulings, equities, and the public-markets beat.',
      color: '#0a7a3b', order_index: 8 },
  ];
  await upsert('categories', cats, 'slug');
}

function buildArticle(item, catMap, flagFeatured, flagBreaking) {
  const slug = item.source === 'PIB' ? slugify(item.title, `pib-${item.prid}`) : slugify(item.title);
  const categorySlug = MINISTRY_TO_CATEGORY[item.ministry] || null;
  if (!categorySlug) return null;
  const cover = COVER_BY_CATEGORY[categorySlug] || COVER_BY_CATEGORY.policy;
  const summary = (item.body || '').slice(0, 240).replace(/\s+\S*$/, '').trim() + '…';
  const kicker = item.ministry
    .replace(/^Ministry of\s+/i, '')
    .replace(/^Department for\s+/i, '')
    .toUpperCase();
  return {
    slug,
    title: item.title,
    kicker,
    subtitle: item.subtitle || null,
    summary,
    content: item.body,
    cover_image_url: cover,
    cover_caption: `Source: ${item.source}. Issued by ${item.ministry}.`,
    category_id: catMap[categorySlug],
    author_id: null,
    status: 'published',
    is_featured: !!flagFeatured,
    is_breaking: !!flagBreaking,
    is_premium: false,
    is_exclusive: false,
    published_at: item.publishedAt,
    read_time_minutes: Math.max(2, Math.round((item.body || '').split(/\s+/).length / 200)),
    tags: [item.source.toLowerCase(), categorySlug, kicker.toLowerCase().replace(/[^a-z]+/g, '-').slice(0, 30)],
  };
}

// ---------------------------------------------------------------------------
// BACKFILL MODE
//
// Sweep PRIDs in an estimated range and keep only those whose parsed
// post-date falls inside [BACKFILL_FROM, BACKFILL_TO]. PRIDs are roughly
// monotonic across ALL languages — empirically ~300/day total — so we can
// estimate the start PRID from the requested date and the highest current
// PRID, then walk forward.
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function highestKnownPrid() {
  const prids = await pibListing();
  return Math.max(...prids.map(Number));
}

// Empirically PIB issues ~300 PRIDs/day across all languages combined.
const PRIDS_PER_DAY = 320;

async function runBackfill(from, to, catMap) {
  const fromTs = new Date(from + 'T00:00:00Z').getTime();
  const toTs   = new Date(to   + 'T23:59:59Z').getTime();
  if (Number.isNaN(fromTs) || Number.isNaN(toTs) || fromTs > toTs) {
    throw new Error(`Invalid date range: ${from} → ${to}`);
  }

  const highest = await highestKnownPrid();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const daysAgo = Math.max(0, Math.ceil((today.getTime() - fromTs) / 86_400_000));
  const startPrid = Math.max(2_000_000, highest - (daysAgo + 2) * PRIDS_PER_DAY);
  // Sweep a generous buffer past today's highest too, in case more were posted today
  const endPrid = highest + 80;
  const total = endPrid - startPrid + 1;

  console.log(`• Backfilling ${from} → ${to}`);
  console.log(`  highest known PRID: ${highest}`);
  console.log(`  sweep range: PRID ${startPrid} → ${endPrid} (~${total} fetches)`);
  console.log(`  est. business-relevant hits: ~${Math.round(total * 0.05)}`);
  console.log(`  est. wall time at 7 req/s: ~${Math.round(total / 7 / 60)} min\n`);

  let scanned = 0, parsed = 0, kept = 0, inserted = 0, errors = 0;
  let batch = [];

  const flush = async () => {
    if (!batch.length) return;
    const rows = batch.map(it => buildArticle(it, catMap, false, false)).filter(Boolean);
    if (rows.length) {
      try {
        await upsert('articles', rows, 'slug');
        inserted += rows.length;
      } catch (e) {
        console.error('\n  upsert error:', e.message);
      }
    }
    batch = [];
  };

  for (let prid = startPrid; prid <= endPrid; prid++) {
    scanned++;
    try {
      const item = await pibDetail(String(prid));
      if (item) parsed++;
      if (item && MINISTRY_TO_CATEGORY[item.ministry]) {
        const ts = new Date(item.publishedAt).getTime();
        if (ts >= fromTs && ts <= toTs) {
          batch.push(item);
          kept++;
          if (batch.length >= 25) await flush();
        }
      }
    } catch (e) {
      errors++;
    }
    if (scanned % 200 === 0) {
      const pct = ((scanned / total) * 100).toFixed(1);
      process.stdout.write(`\r  scanned ${scanned}/${total} (${pct}%)  parsed ${parsed}  kept ${kept}  inserted ${inserted}  err ${errors}      `);
    }
    // Rate-limit ~7 req/s so we're polite to PIB
    await sleep(140);
  }
  await flush();
  console.log(`\n• Done. scanned ${scanned}  parsed ${parsed}  kept ${kept}  inserted ${inserted}  errors ${errors}`);
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
(async () => {
  console.log('• Ensuring banking + markets categories…');
  await ensureCategories();

  console.log('• Reading category IDs…');
  const cats = await rest('categories?select=id,slug');
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.id]));

  const from = process.env.BACKFILL_FROM;
  const to   = process.env.BACKFILL_TO || new Date().toISOString().slice(0, 10);
  if (from) {
    await runBackfill(from, to, catMap);
    return;
  }

  // ---- LIVE MODE (default, used by cron) ----
  console.log('• Fetching PIB English release listing…');
  const prids = await pibListing();
  console.log(`  ${prids.length} PRIDs found`);

  const items = [];
  for (const prid of prids.slice(0, 40)) {            // cap per run
    try {
      const item = await pibDetail(prid);
      if (item && MINISTRY_TO_CATEGORY[item.ministry]) {
        items.push(item);
        process.stdout.write('.');
      } else {
        process.stdout.write('·');
      }
    } catch (e) {
      process.stdout.write('x');
    }
  }
  console.log(`\n  ${items.length} business-relevant releases parsed`);

  if (!items.length) { console.log('Nothing to insert.'); return; }

  // Newest first
  items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const rows = items
    .map((it, i) => buildArticle(it, catMap, i === 0, i < 3))
    .filter(Boolean);

  console.log(`• Upserting ${rows.length} articles…`);
  await upsert('articles', rows, 'slug');

  console.log('• Done. Newest:');
  rows.slice(0, 5).forEach(r => console.log(`   – [${r.kicker}] ${r.title.slice(0, 90)}`));
})().catch(e => { console.error(e); process.exit(1); });
