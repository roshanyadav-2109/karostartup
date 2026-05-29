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

// Browser-shaped headers — PIB returns 403 to obvious bot UAs.
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,en-IN;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Referer': 'https://pib.gov.in/',
};

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

// -- Title denylist --------------------------------------------------------
// Even within "business" ministries (Finance especially) PIB publishes a lot
// of items that aren't business/finance news for founders: drug/customs
// seizures, govt outreach campaigns (PRARAMBH), inauguration ceremonies,
// review meetings, foundation-day events, capacity-building training. Drop
// titles that contain any of these substrings (case-insensitive).
const TITLE_DENY_RE = new RegExp([
  'seiz', 'smuggl', 'raid', 'crackdown', 'contraband', 'illicit',
  'narcot', 'drug', 'opium', 'heroin', 'cocaine', 'hashish', 'ganja', 'cannabis',
  'cigarette', 'vape', 'e-cigarette',
  'prarambh',
  'outreach programme', 'outreach program',
  'awareness programme', 'awareness program',
  'literacy camp', 'literacy programme', 'literacy program',
  'capacity building',
  'training programme', 'training program',
  'mou for training',
  'review meeting',
  'inaugurat', 'bhawan',
  'keynote address', 'valedictory',
  'foundation day', 'anniversary celebr',
  'swearing-in',
].join('|'), 'i');

// -- Ministry → category mapping -------------------------------------------
// Tight allowlist: only ministries that actually issue business / finance /
// MSME / tech / industry / markets news relevant to founders. Everything
// else (railways, petroleum/coal/power/steel PSU news, civil aviation,
// road/housing/cooperation/agriculture/consumer-affairs, govt PR via
// Information & Broadcasting / Communications / PIB Headquarters,
// heavy industries, renewable-energy PSU items) is intentionally dropped.
const MINISTRY_TO_CATEGORY = {
  // Finance / monetary / tax / fiscal / markets
  'Ministry of Finance':                              'banking',
  'Ministry of Corporate Affairs':                    'markets',
  'Ministry of Statistics & Programme Implementation':'markets',
  // Industry / commerce / MSME
  'Ministry of Commerce & Industry':                  'policy',
  'Department for Promotion of Industry and Internal Trade': 'policy',
  'Ministry of Micro, Small & Medium Enterprises':    'policy',
  // Tech / digital
  'Ministry of Electronics & IT':                     'ai',
  // Economic policy / planning
  'NITI Aayog':                                       'policy',
  // Business-sector industries (D2C / consumer brand surface)
  'Ministry of Food Processing Industries':           'd2c',
  'Ministry of Textiles':                             'd2c',
};

// Site policy: if PIB didn't publish a real image with the release, leave
// cover_image_url null. The frontend renders these cards without an image
// rather than substituting a stock photo.

// Extract the first content image from a PIB release page. PIB hosts its own
// images under /WriteReadData/userfiles/image/... so we prefer those; only
// fall back to anything else if we don't find one. Returns an absolute URL or
// null. Skips obvious chrome (logos/icons/spacers).
function extractPibImage(html) {
  if (!html) return null;
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const candidates = [];
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    let src = m[1].trim();
    if (!src) continue;
    // Skip data URIs, tracking pixels, and obvious chrome.
    if (/^data:/i.test(src)) continue;
    if (/(logo|icon|spacer|loader|pib_?(logo|hindi)|emblem|ashoka|tricolour|favicon|share|whatsapp|facebook|twitter|linkedin|youtube|instagram|print|pdf|search|menu|arrow|btn_)/i.test(src)) continue;
    // Absolutize.
    if (src.startsWith('//')) src = 'https:' + src;
    else if (src.startsWith('/')) src = 'https://pib.gov.in' + src;
    else if (!/^https?:/i.test(src)) src = 'https://pib.gov.in/' + src.replace(/^\.?\//, '');
    // Prefer real content images (jpg/jpeg/png/webp under userfiles).
    if (!/\.(jpe?g|png|webp|gif)(\?|$)/i.test(src)) continue;
    candidates.push(src);
  }
  // Prefer PIB-hosted userfiles images first.
  const pibHosted = candidates.find(u => /pib\.gov\.in\/.*userfiles/i.test(u));
  return pibHosted || candidates[0] || null;
}

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

  // Try to harvest a content image from the release body / page. Falls back
  // to null and the caller will pick a category-pool image.
  const heroImage = extractPibImage(bodyHtml) || extractPibImage(html);

  return {
    prid,
    title,
    subtitle,
    ministry,
    publishedAt: parsePibDate(dateRaw),
    body,
    heroImage,
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

// Build a readable summary: prefer PIB's own subtitle (it's written as a
// one-line gist), else assemble the first complete sentences of the body up
// to ~320 chars. Never cut mid-word/mid-sentence.
function makeSummary(item) {
  const sub = (item.subtitle || '').replace(/\s+/g, ' ').trim();
  if (sub && sub.length >= 40) return sub;

  const text = (item.body || '').replace(/\s+/g, ' ').trim();
  if (!text) return sub || null;

  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  if (!sentences || !sentences.length) {
    // No sentence punctuation — fall back to a clean word-boundary cut.
    if (text.length <= 320) return text;
    return text.slice(0, 300).replace(/\s+\S*$/, '').trim() + '…';
  }
  let out = '';
  for (const s of sentences) {
    if (out && (out + s).length > 340) break;
    out += s;
    if (out.length >= 220) break;
  }
  out = out.trim();
  if (!out) out = sentences[0].trim();
  // Append an ellipsis only if there is meaningfully more text after it.
  return out + (text.length > out.length + 20 ? ' …' : '');
}

function buildArticle(item, catMap, flagFeatured, flagBreaking) {
  const slug = item.source === 'PIB' ? slugify(item.title, `pib-${item.prid}`) : slugify(item.title);
  const categorySlug = MINISTRY_TO_CATEGORY[item.ministry] || null;
  if (!categorySlug) return null;
  if (TITLE_DENY_RE.test(item.title)) return null;
  // Only set a cover when PIB actually published one for this release.
  // The site is configured to render no image at all when this is null.
  const cover = item.heroImage || null;
  const summary = makeSummary(item);
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
      if (item && MINISTRY_TO_CATEGORY[item.ministry] && !TITLE_DENY_RE.test(item.title)) {
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
// FIX_COVERS MODE
//
// One-shot pass over existing PIB articles already in the DB. For each:
//   1. If slug ends in `-pib-<PRID>`, refetch that page and try to extract
//      the real content image (cheap; ~7 req/s).
//   2. Otherwise (or on failure) pick a deterministic image from the
//      category pool keyed off slug+category so the homepage stops showing
//      one Unsplash photo on every card.
// Updates cover_image_url in place via PATCH. Run once after deploy.
// ---------------------------------------------------------------------------
async function runFixCovers() {
  console.log('• Loading existing PIB articles…');
  // We need slug, category_id, and current cover. Filter to PIB-sourced
  // by tag (legacy import also tagged things `pib` selectively, so we
  // also catch slugs ending in `-pib-<digits>`).
  const cats = await rest('categories?select=id,slug');
  const catSlugById = Object.fromEntries(cats.map(c => [c.id, c.slug]));

  // Pull in pages of 1000.
  const PAGE = 1000;
  let offset = 0;
  let all = [];
  for (;;) {
    const batch = await rest(
      `articles?select=id,slug,category_id,cover_image_url,tags&or=(tags.cs.{pib},slug.like.*-pib-*)&order=id.asc&limit=${PAGE}&offset=${offset}`
    );
    if (!batch || !batch.length) break;
    all = all.concat(batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  console.log(`  ${all.length} articles to consider`);

  let refetched = 0, foundReal = 0, fallback = 0, errors = 0;
  const updates = [];

  for (const a of all) {
    const slug = a.slug || '';
    const cat = catSlugById[a.category_id] || 'policy';
    let newCover = null;

    const pridM = slug.match(/-pib-(\d+)$/);
    if (pridM) {
      try {
        const url = `https://pib.gov.in/PressReleasePage.aspx?PRID=${pridM[1]}`;
        const res = await fetch(url, { headers: UA });
        refetched++;
        if (res.ok) {
          const html = await res.text();
          const img = extractPibImage(html);
          if (img) { newCover = img; foundReal++; }
        }
      } catch { errors++; }
      // Be polite to PIB.
      await sleep(140);
    }

    // If no real PIB image was found, clear any existing fake cover so the
    // card simply renders without an image. We never substitute a stock photo.
    if (!newCover) { newCover = null; fallback++; }
    if (newCover !== a.cover_image_url) {
      updates.push({ id: a.id, cover_image_url: newCover });
    }

    if ((refetched + fallback) % 50 === 0) {
      process.stdout.write(`\r  processed ${refetched + fallback}/${all.length}  real ${foundReal}  cleared ${fallback}  err ${errors}      `);
    }
  }

  console.log(`\n• Applying ${updates.length} cover updates…`);
  // PATCH in chunks of 100 (one PATCH per row — Supabase PostgREST doesn't
  // support bulk per-row updates without upsert + full payload).
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    try {
      await rest(`articles?id=eq.${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ cover_image_url: u.cover_image_url }),
      });
    } catch (e) {
      console.error(`\n  patch error for ${u.id}: ${e.message}`);
    }
    if ((i + 1) % 50 === 0) process.stdout.write(`\r  patched ${i + 1}/${updates.length}      `);
  }
  console.log(`\n• Done. refetched ${refetched}  real ${foundReal}  fallback ${fallback}  updated ${updates.length}  errors ${errors}`);
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

  if (process.env.FIX_COVERS) {
    await runFixCovers();
    return;
  }

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
      if (item && MINISTRY_TO_CATEGORY[item.ministry] && !TITLE_DENY_RE.test(item.title)) {
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
