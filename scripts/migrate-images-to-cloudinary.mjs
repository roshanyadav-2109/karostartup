#!/usr/bin/env node
/**
 * Migrate all old-AWS-S3 article images (thekarostartup.s3.ap-south-1.amazonaws.com)
 * to Cloudinary, then rewrite the URLs in Supabase so the new site no longer
 * depends on the old AWS account.
 *
 * For each unique S3 image URL found in articles.cover_image_url or
 * articles.content, it does a SIGNED upload-by-URL to Cloudinary (Cloudinary
 * fetches the image itself), then rewrites that URL everywhere it appears.
 *
 * Idempotent: deterministic public_id + overwrite=false means re-runs return the
 * existing Cloudinary asset; once an article's URLs are rewritten it has no more
 * S3 URLs to migrate. Non-destructive: the old S3 images are only COPIED.
 *
 * Env:
 *   CLD_CLOUD, CLD_KEY, CLD_SECRET   Cloudinary credentials
 *   SUPABASE_SERVICE_ROLE_KEY        Supabase service role key
 *   DRY_RUN=1                        upload to Cloudinary but DON'T write the DB
 *   LIMIT=N                          only process the first N matching articles
 */
import crypto from 'node:crypto';
import { writeFileSync, appendFileSync } from 'node:fs';

const CLOUD  = process.env.CLD_CLOUD;
const KEY    = process.env.CLD_KEY;
const SECRET = process.env.CLD_SECRET;
const SRK    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY    = process.env.DRY_RUN === '1';
const LIMIT  = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const SB     = 'https://svwpvqmqmisoffbnnjdc.supabase.co/rest/v1';
const S3_HOST = 'thekarostartup.s3.ap-south-1.amazonaws.com';
const S3_RE  = /https?:\/\/thekarostartup\.s3\.ap-south-1\.amazonaws\.com\/[^\s"'<>\\)]+/g;
const CONCURRENCY = 6;
const MAP_LOG = '/tmp/cld-url-map.json';

if (!CLOUD || !KEY || !SECRET || !SRK) { console.error('Missing CLD_CLOUD/CLD_KEY/CLD_SECRET/SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const sbHeaders = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };

// ---- fetch articles that still reference the old S3 (paginated) ----
async function fetchArticles() {
  const out = [];
  const filter = `or=(cover_image_url.ilike.*${S3_HOST}*,content.ilike.*${S3_HOST}*)`;
  for (let offset = 0; ; offset += 1000) {
    const url = `${SB}/articles?select=id,slug,cover_image_url,content&${filter}&order=id.asc&limit=1000&offset=${offset}`;
    const r = await fetch(url, { headers: sbHeaders });
    if (!r.ok) throw new Error(`fetch articles ${r.status}: ${await r.text()}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// ---- Cloudinary signed upload-by-URL (idempotent) ----
function publicIdFor(s3url) {
  let p = new URL(s3url).pathname.replace(/^\/+/, '');     // uploads/article_images/FILE.png
  try { p = decodeURIComponent(p); } catch {}
  p = p.replace(/\.[a-zA-Z0-9]+$/, '');                     // strip extension
  p = ('karostartup/' + p).replace(/[^A-Za-z0-9/_.-]/g, '_');
  return p;
}
async function uploadByUrl(s3url, tries = 3) {
  const public_id = publicIdFor(s3url);
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `overwrite=false&public_id=${public_id}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(toSign + SECRET).digest('hex');
  const body = new URLSearchParams({ file: s3url, api_key: KEY, timestamp: String(timestamp), public_id, overwrite: 'false', signature });
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body });
      const j = await r.json();
      if (r.ok && j.secure_url) {
        // inject f_auto,q_auto for optimized CDN delivery
        return j.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
      }
      if (i === tries) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    } catch (e) { if (i === tries) throw e; }
    await new Promise(res => setTimeout(res, 800 * i));
  }
}

// simple concurrency pool
async function pool(items, n, fn) {
  const results = new Array(items.length); let idx = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) { const i = idx++; try { results[i] = await fn(items[i], i); } catch (e) { results[i] = { error: e.message }; } }
  }));
  return results;
}

(async () => {
  console.log(`Cloudinary image migration ${DRY ? '(DRY RUN — no DB writes)' : '(LIVE)'}${LIMIT !== Infinity ? `  LIMIT=${LIMIT}` : ''}`);
  let articles = await fetchArticles();
  console.log(`  ${articles.length} articles reference the old S3`);
  if (LIMIT !== Infinity) articles = articles.slice(0, LIMIT);

  // collect unique S3 URLs across covers + bodies
  const urls = new Set();
  for (const a of articles) {
    if (a.cover_image_url && a.cover_image_url.includes(S3_HOST)) urls.add(a.cover_image_url.trim());
    for (const m of (a.content || '').matchAll(S3_RE)) urls.add(m[0]);
  }
  const uniq = [...urls];
  console.log(`  ${uniq.length} unique S3 image URLs to upload`);

  // upload all (idempotent), build oldURL -> cloudinaryURL map
  let done = 0, failed = 0;
  const res = await pool(uniq, CONCURRENCY, async (u) => {
    const newUrl = await uploadByUrl(u);
    if (++done % 50 === 0) process.stdout.write(`\r  uploaded ${done}/${uniq.length} (failed ${failed})   `);
    return newUrl;
  });
  const map = {};
  uniq.forEach((u, i) => { if (res[i] && typeof res[i] === 'string') map[u] = res[i]; else failed++; });
  console.log(`\n  uploaded ${Object.keys(map).length}/${uniq.length}  (failed ${failed})`);
  writeFileSync(MAP_LOG, JSON.stringify(map, null, 2));
  console.log(`  url map saved -> ${MAP_LOG}`);

  // rewrite each article's cover + content
  let updated = 0, skipped = 0, errs = 0;
  for (const a of articles) {
    let cover = a.cover_image_url, content = a.content || '', changed = false;
    if (cover && map[cover.trim()]) { cover = map[cover.trim()]; changed = true; }
    if (content.includes(S3_HOST)) {
      for (const [oldU, newU] of Object.entries(map)) {
        if (content.includes(oldU)) { content = content.split(oldU).join(newU); changed = true; }
      }
    }
    if (!changed) { skipped++; continue; }
    if (DRY) { updated++; continue; }
    const r = await fetch(`${SB}/articles?id=eq.${a.id}`, {
      method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ cover_image_url: cover, content }),
    });
    if (r.ok) updated++; else { errs++; console.error(`  PATCH ${a.slug} -> ${r.status} ${await r.text()}`.slice(0, 160)); }
    if ((updated + errs) % 100 === 0) process.stdout.write(`\r  db updated ${updated} (err ${errs})   `);
  }
  console.log(`\n${DRY ? 'WOULD update' : 'updated'} ${updated} articles, skipped ${skipped}, errors ${errs}`);
  if (failed) console.log(`  NOTE: ${failed} images failed to upload and were left on S3 (re-run to retry).`);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
