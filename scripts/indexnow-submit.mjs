#!/usr/bin/env node
/**
 * Push recently published/updated URLs to IndexNow (Bing, Yandex, Naver, Seznam).
 *
 * IndexNow is a "tell me the moment it changes" protocol — instead of waiting for
 * a crawler to rediscover the sitemap, we notify search engines directly. Google
 * does not consume IndexNow; for Google the sitemap + news sitemap + the internal
 * links on the SSR'd category hubs do the discovery job.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/indexnow-submit.mjs [hoursBack]
 *
 * Default window is 24h (the sitemap workflow runs hourly, so this stays well
 * inside it). The key file must be reachable at https://<host>/<key>.txt.
 */

const KEY = '1292238bc85c0966e4546e32b6ef9549';
const HOST = 'www.karostartup.com';
const ORIGIN = `https://${HOST}`;
const KEY_LOCATION = `${ORIGIN}/${KEY}.txt`;

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const HOURS = Number(process.argv[2] || 24);
const since = new Date(Date.now() - HOURS * 3600 * 1000).toISOString();

async function rest(path) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`GET ${path}: ${r.status}`);
  return r.json();
}

(async () => {
  // Anything published OR edited inside the window is worth re-announcing.
  const rows = await rest(
    `articles?select=slug,published_at,updated_at,source,approved_for_public&status=eq.published` +
    `&or=(published_at.gte.${since},updated_at.gte.${since})&order=published_at.desc&limit=1000`
  );

  // Mirror sitemap visibility rules: don't announce hidden auto-fetched PIB posts.
  let autoFetchVisible = false;
  try {
    const s = await rest('site_settings?select=value&key=eq.auto_fetch');
    autoFetchVisible = s?.[0]?.value?.public_visible === true;
  } catch { autoFetchVisible = false; }
  const visible = rows.filter((a) => a.source !== 'pib' || a.approved_for_public === true || autoFetchVisible);

  const urlList = visible.map((a) => `${ORIGIN}/article/${encodeURIComponent(a.slug)}`);
  // Always re-announce the hubs so the fresh article's internal links get recrawled.
  urlList.push(ORIGIN, `${ORIGIN}/sitemap.xml`, `${ORIGIN}/news-sitemap.xml`);

  if (!urlList.length) { console.log('Nothing to submit.'); return; }
  console.log(`Submitting ${urlList.length} URLs to IndexNow (window: ${HOURS}h)…`);

  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
  });
  // 200 = accepted, 202 = accepted pending key validation. Both are success.
  const body = await r.text().catch(() => '');
  if (r.status === 200 || r.status === 202) {
    console.log(`✓ IndexNow accepted (HTTP ${r.status}) — ${urlList.length} URLs`);
  } else {
    console.error(`IndexNow returned HTTP ${r.status}: ${body.slice(0, 300)}`);
    process.exit(0); // never fail the workflow over a third-party ping
  }
})().catch((e) => { console.error(e.message); process.exit(0); });
