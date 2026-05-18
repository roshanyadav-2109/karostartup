#!/usr/bin/env node
/**
 * Pull recent reels from the @karostartup Instagram Business/Creator
 * account and upsert them into public.shorts.
 *
 * Required env:
 *   SUPABASE_SERVICE_ROLE_KEY   service-role JWT
 *   IG_USER_ID                  numeric Instagram User ID (NOT the @handle)
 *   IG_ACCESS_TOKEN             long-lived Page-scoped access token with
 *                               instagram_basic + pages_read_engagement
 *
 * Setup checklist (one-time):
 *   1. Convert @karostartup to a Business or Creator account.
 *   2. Link it to a Facebook Page (Settings → Linked Accounts).
 *   3. Create a Meta App at developers.facebook.com → add the Instagram
 *      Graph API product → grant `instagram_basic`, `pages_show_list`,
 *      `pages_read_engagement`.
 *   4. Generate a long-lived Page access token via Graph API Explorer:
 *        GET /me/accounts?access_token=USER_TOKEN
 *        → copy the page access_token for the linked Page
 *        GET /oauth/access_token?grant_type=fb_exchange_token&client_id=...
 *           &client_secret=...&fb_exchange_token=PAGE_TOKEN
 *        → long-lived token (60 days)
 *   5. Find the IG user id:
 *        GET /{page-id}?fields=instagram_business_account&access_token=...
 *   6. Add IG_USER_ID and IG_ACCESS_TOKEN to GitHub repo Secrets.
 *
 * Reel videos returned by Graph API have a temporary `media_url` that
 * expires in ~5 days, so we mirror them into the `shorts` Supabase
 * Storage bucket and store the permanent public URL.
 */

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IGU  = process.env.IG_USER_ID;
const IGT  = process.env.IG_ACCESS_TOKEN;

if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!IGU || !IGT) { console.error('Set IG_USER_ID and IG_ACCESS_TOKEN'); process.exit(1); }

const GRAPH = `https://graph.facebook.com/v21.0`;

async function gget(path) {
  const r = await fetch(`${GRAPH}/${path}${path.includes('?') ? '&' : '?'}access_token=${IGT}`);
  if (!r.ok) throw new Error(`Graph ${path} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function sb(path, init = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase ${path} → HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

async function mirrorToStorage(mediaUrl, filename, contentType) {
  // Download from Instagram's CDN (these URLs expire) then upload to our bucket.
  const resp = await fetch(mediaUrl);
  if (!resp.ok) throw new Error(`Download ${mediaUrl.slice(0, 60)}… → HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const up = await fetch(`${BASE}/storage/v1/object/shorts/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buf,
  });
  if (!up.ok && up.status !== 409) {
    throw new Error(`Storage upload ${filename} → HTTP ${up.status}: ${await up.text()}`);
  }
  return `${BASE}/storage/v1/object/public/shorts/${encodeURIComponent(filename)}`;
}

(async () => {
  console.log(`Fetching reels from IG user ${IGU}…`);
  // Reels appear as media_type=VIDEO with media_product_type=REELS.
  const fields = 'id,media_type,media_product_type,media_url,permalink,thumbnail_url,caption,timestamp';
  const { data: media = [] } = await gget(`${IGU}/media?fields=${fields}&limit=25`);

  const reels = media.filter(m =>
    (m.media_type === 'VIDEO' || m.media_type === 'REEL') &&
    (m.media_product_type === 'REELS' || !m.media_product_type)
  );
  console.log(`Got ${reels.length} reels from ${media.length} media items`);

  let inserted = 0, skipped = 0, failed = 0;
  for (const r of reels) {
    try {
      // Skip if already in DB (look up by permalink — IG IDs change across token refreshes).
      const existing = await sb(`shorts?select=id&caption=eq.${encodeURIComponent('ig:' + r.id)}`);
      if (existing.length) { skipped++; continue; }

      // Mirror video + thumbnail to Supabase Storage (CDN URLs from IG expire).
      const videoUrl = await mirrorToStorage(r.media_url, `ig-${r.id}.mp4`, 'video/mp4');
      const thumbUrl = r.thumbnail_url
        ? await mirrorToStorage(r.thumbnail_url, `ig-${r.id}.jpg`, 'image/jpeg').catch(() => null)
        : null;

      // First 80 chars of caption → title; full caption stored alongside.
      const caption = (r.caption || '').trim();
      const title = caption.split('\n')[0].slice(0, 80) || `Reel ${r.id.slice(-6)}`;

      await sb('shorts', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          title,
          // Prefix lets us look up "is this IG reel already imported?" without an
          // extra column. Stored as caption so it's also useful editorially.
          caption: `ig:${r.id}\n${caption}`,
          video_url: videoUrl,
          thumbnail_url: thumbUrl,
          is_published: true,
          sort_order: 0,
        }),
      });
      inserted++;
      console.log(`  + ${title.slice(0, 60)}`);
    } catch (e) {
      failed++;
      console.warn(`  · skip ${r.id}: ${e.message}`);
    }
  }

  console.log(`\nDone — ${inserted} new, ${skipped} already imported, ${failed} failed.`);
})().catch((e) => { console.error(e); process.exit(1); });
