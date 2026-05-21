#!/usr/bin/env node
/**
 * Import articles from the old MySQL karostartup_backup.sql into the
 * current Supabase PostgreSQL schema.
 *
 *  - Parses the 21 chunked `INSERT INTO articles VALUES (…)` statements
 *    character-by-character (handles \\, \', \", \n in MySQL string literals).
 *  - Parses categories + article_categories the same way.
 *  - For each article: maps the old category to a current Supabase category
 *    slug. Articles tagged only with "General" use a title-keyword heuristic
 *    (fund → funding, IPO → markets, founder → founders, AI → ai, etc.).
 *  - Strips HTML for the summary, keeps full HTML in content.
 *  - Upserts on slug. PIB articles (slug ends in -pib-NNNN) are untouched.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/import-legacy-articles.mjs
 *
 *   DRY=1 SUPABASE_SERVICE_ROLE_KEY=… node scripts/import-legacy-articles.mjs
 *     → parse + map + classify, but do not write to Supabase. Prints a
 *       distribution of how many articles would land in each category.
 */

import fs from 'node:fs';

const DUMP = 'C:/Users/singh/Downloads/karostartup_backup.sql/karostartup_backup.sql';
const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = !!process.env.DRY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY (or DRY=1)'); if (!DRY) process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

// ---------- MySQL tuple parser -----------------------------------------------
//
// Reads `VALUES (...),(...),...;` and yields each row as an array of values.
// Handles string escapes (\\, \', \", \n, \r, \t, \0), NULL keyword, integers,
// floats, and bare identifiers.
function* parseTuples(body) {
  let i = 0;
  const len = body.length;
  while (i < len) {
    // skip whitespace + commas between tuples
    while (i < len && (body[i] === ',' || body[i] === ' ' || body[i] === '\n' || body[i] === '\r' || body[i] === '\t')) i++;
    if (i >= len || body[i] === ';') return;
    if (body[i] !== '(') { i++; continue; }
    i++; // skip (
    const tuple = [];
    let buf = '';
    let inStr = false;
    let strDelim = "'";
    while (i < len) {
      const c = body[i];
      if (inStr) {
        if (c === '\\') {
          // escape: backslash + next char
          const next = body[i + 1];
          switch (next) {
            case 'n': buf += '\n'; break;
            case 'r': buf += '\r'; break;
            case 't': buf += '\t'; break;
            case '0': buf += '\0'; break;
            case '\\': buf += '\\'; break;
            case "'": buf += "'"; break;
            case '"': buf += '"'; break;
            case 'Z': buf += '\x1A'; break;
            default: buf += next;
          }
          i += 2;
          continue;
        }
        if (c === strDelim) {
          // doubled quote → literal quote (MySQL also supports '' inside ')
          if (body[i + 1] === strDelim) { buf += strDelim; i += 2; continue; }
          inStr = false;
          tuple.push(buf);
          buf = '';
          i++;
          continue;
        }
        buf += c;
        i++;
        continue;
      }
      // outside string
      if (c === "'" || c === '"') {
        inStr = true;
        strDelim = c;
        i++;
        continue;
      }
      if (c === ',') {
        if (buf.length) { tuple.push(coerce(buf)); buf = ''; }
        i++;
        continue;
      }
      if (c === ')') {
        if (buf.length) { tuple.push(coerce(buf)); buf = ''; }
        i++;
        yield tuple;
        break;
      }
      // accumulate
      buf += c;
      i++;
    }
  }
}

function coerce(s) {
  s = s.trim();
  if (s === 'NULL') return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  return s; // bare identifier (shouldn't really happen in our data)
}

// ---------- Read dump and slice by table ------------------------------------
const sql = fs.readFileSync(DUMP, 'utf-8');

function tuplesFor(tableName) {
  const inserts = [];
  const marker = `INSERT INTO \`${tableName}\` VALUES`;
  let pos = 0;
  while (true) {
    const idx = sql.indexOf(marker, pos);
    if (idx < 0) break;
    const end = sql.indexOf(';\n', idx);
    inserts.push({ start: idx + marker.length, end });
    pos = end + 1;
  }
  const all = [];
  for (const { start, end } of inserts) {
    for (const t of parseTuples(sql.slice(start, end))) all.push(t);
  }
  return all;
}

// ---------- Build category mappings -----------------------------------------
const categoriesOld = tuplesFor('categories'); // (id, name, slug, image, desc, ..., created, updated)
const articleCats = tuplesFor('article_categories'); // (category_id, article_id)
const oldSlugById = {};
for (const c of categoriesOld) oldSlugById[c[0]] = c[2];

// article_id → array of old category slugs (in order from the join table)
const oldCatSlugsByArticleId = {};
for (const [catId, artId] of articleCats) {
  const slug = oldSlugById[catId];
  if (!slug) continue;
  (oldCatSlugsByArticleId[artId] ||= []).push(slug);
}

// Old → new category slug mapping. Articles with only "general" use a title
// heuristic instead.
const OLD_TO_NEW = {
  'startup-stories':    'startups',
  'news':               'policy',
  'press-release':      'policy',
  'success-stories':    'startups',
  'startup-news':       'startups',
  'business-models':    'saas',
  'funding':            'funding',
  'ipo':                'markets',
  'best-brands':        'd2c',
  'technology':         'ai',
  'innovation':         'ai',
  'marketing':          'd2c',
  'products':           'd2c',
  'finance':            'banking',
  'growth':             'startups',
  'founder-interviews': 'founders',
  'case-studies':       'startups',
  'tech-updates':       'ai',
  'trends':             'opinion',
};

function heuristicSlug(title) {
  const t = title || '';
  if (/\b(fund(ing|ed)?|series\s+[a-d]\b|raises?\b|raised\b|invest(or|ment)?|venture\s+capital|seed\s+round|crore\s+(round|funding|raise)|million\s+(raise|raised|funding))\b/i.test(t)) return 'funding';
  if (/\b(IPO\b|stock\s+market|sebi\b|nse\b|bse\b|equity\s+market|share\s+price|listing)\b/i.test(t)) return 'markets';
  if (/\b(founder|co-?founder|CEO\b|CTO\b|CFO\b|chairman|founder's\s+story)\b/i.test(t)) return 'founders';
  if (/\b(AI\b|artificial\s+intelligence|GenAI|generative\s+AI|GPT|LLM|chatbot|machine\s+learning)\b/i.test(t)) return 'ai';
  if (/\b(SaaS|software\s+(as\s+a\s+service|platform)|cloud\s+platform|cybersecurity)\b/i.test(t)) return 'saas';
  if (/\b(D2C\b|consumer\s+brand|FMCG|brand\s+launch|product\s+launch|retail\s+chain)\b/i.test(t)) return 'd2c';
  if (/\b(EV\b|electric\s+vehicle|renewable|solar|cleantech|climate\s+tech|carbon|green\s+(energy|tech))\b/i.test(t)) return 'climate';
  if (/\b(fintech|UPI|payments|lending|loan|digital\s+wallet|neobank)\b/i.test(t)) return 'fintech';
  if (/\b(policy|government|ministry|regulation|cabinet|RBI\b)\b/i.test(t)) return 'policy';
  return 'startups'; // default for "general" Indian-startup ecosystem content
}

// ---------- Fetch Supabase category ID map ----------------------------------
async function fetchCatMap() {
  if (DRY) {
    // Placeholder slugs → fake UUIDs for DRY mode
    return Object.fromEntries(['ai','banking','climate','d2c','ev','fintech','founders','funding','markets','opinion','policy','research','saas','startups'].map(s => [s, '00000000-' + s]));
  }
  const r = await fetch(`${BASE}/rest/v1/categories?select=id,slug`, { headers: H });
  const j = await r.json();
  return Object.fromEntries(j.map(c => [c.slug, c.id]));
}

// ---------- HTML → text helpers ---------------------------------------------
function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
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

function makeSummary(excerpt, content) {
  const src = excerpt && excerpt.trim() ? excerpt : htmlToText(content).slice(0, 360);
  const t = src.trim();
  return t.length > 240 ? t.slice(0, 240).replace(/\s+\S*$/, '').trim() + '…' : t;
}

// ---------- Validate row ----------------------------------------------------
// Skip obvious junk like the article whose title is just an email address.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function isJunkTitle(title) {
  if (!title) return true;
  const t = title.trim();
  if (t.length < 5) return true;
  if (EMAIL_RE.test(t)) return true;
  return false;
}

// ---------- Build the new article row ---------------------------------------
function buildArticle(oldRow, catMap) {
  // Old schema column order:
  // (id, title, slug, excerpt, content, featured_image, author_id, tags,
  //  status, view_count, published_at, meta_title, meta_description,
  //  meta_keywords, created_at, updated_at)
  const [id, title, slug, excerpt, content, featured_image, _author_id, tagsJson,
         status, view_count, published_at, _mt, _md, _mk, created_at, updated_at] = oldRow;

  if (isJunkTitle(title)) return null;

  const oldSlugs = oldCatSlugsByArticleId[id] || [];
  // Prefer first non-general specific category
  const specific = oldSlugs.find(s => s !== 'general');
  const newSlug = specific
    ? (OLD_TO_NEW[specific] || 'startups')
    : heuristicSlug(title);

  const categoryId = catMap[newSlug] || catMap['startups'];
  let tagsArr = [];
  try {
    if (tagsJson && typeof tagsJson === 'string') tagsArr = JSON.parse(tagsJson);
    else if (Array.isArray(tagsJson)) tagsArr = tagsJson;
  } catch {}
  if (!Array.isArray(tagsArr)) tagsArr = [];
  // Mark imported + add the resolved category slug
  tagsArr = [...new Set(['legacy', newSlug, ...tagsArr.map(String).slice(0, 8)])];

  const summary = makeSummary(excerpt, content);
  const kicker = (specific || newSlug).toUpperCase().replace(/-/g, ' ');

  return {
    slug: String(slug).slice(0, 200),
    title: String(title).slice(0, 255),
    kicker,
    subtitle: null,
    summary,
    content: String(content || ''),
    cover_image_url: featured_image || null,
    cover_caption: null,
    category_id: categoryId,
    author_id: null,
    status: status === 'archived' ? 'draft' : (status || 'published'),
    is_featured: false,
    is_breaking: false,
    is_premium: false,
    is_exclusive: false,
    published_at: published_at || created_at,
    read_time_minutes: Math.max(2, Math.round(htmlToText(content).split(/\s+/).length / 200)),
    tags: tagsArr,
    view_count: Number(view_count) || 0,
    // intentionally let DB defaults handle created_at/updated_at — old timestamps
    // may not be timezone-tagged in a way PostgREST accepts cleanly
  };
}

// ---------- MAIN ------------------------------------------------------------
(async () => {
  console.log('Parsing categories…');
  console.log(`  ${categoriesOld.length} categories, ${articleCats.length} article→category mappings`);

  console.log('Parsing articles…');
  const articles = tuplesFor('articles');
  console.log(`  ${articles.length} article rows`);

  const catMap = await fetchCatMap();
  if (!Object.keys(catMap).length) { console.error('No categories found in Supabase'); process.exit(1); }

  const rows = [];
  const skipped = [];
  for (const a of articles) {
    const built = buildArticle(a, catMap);
    if (!built) { skipped.push(a[0] + ':' + (a[1] || '')); continue; }
    rows.push(built);
  }
  console.log(`Built ${rows.length} rows, skipped ${skipped.length} (junk/empty)`);

  // Distribution by new category
  const dist = {};
  for (const r of rows) {
    const slug = Object.entries(catMap).find(([_, v]) => v === r.category_id)?.[0] || '?';
    dist[slug] = (dist[slug] || 0) + 1;
  }
  console.log('\nDistribution by target category:');
  for (const [slug, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${slug}`);
  }

  if (DRY) {
    console.log('\nDRY mode — no upsert.');
    console.log('Sample first 3 rows:');
    for (const r of rows.slice(0, 3)) console.log('  -', r.slug, '|', r.kicker, '|', r.title.slice(0, 70));
    return;
  }

  // Upsert in chunks (PostgREST has request-size limits; legacy content
  // is HTML-heavy, so keep chunks modest).
  const CHUNK = 50;
  let ok = 0, fail = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const r = await fetch(`${BASE}/rest/v1/articles?on_conflict=slug`, {
      method: 'POST',
      headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(slice),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error(`\n  chunk ${i}-${i + slice.length} failed: ${r.status}\n  ${err.slice(0, 400)}`);
      fail += slice.length;
    } else {
      ok += slice.length;
    }
    process.stdout.write(`\r  upserted ${ok}/${rows.length}  (failed ${fail})   `);
  }
  console.log(`\nDone. ${ok} ok, ${fail} failed.`);
})().catch(e => { console.error(e); process.exit(1); });
