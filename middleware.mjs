/**
 * Vercel Routing Middleware (Node runtime) — server-side Open Graph / meta
 * injection for link-preview crawlers (WhatsApp, Facebook, X/Twitter,
 * LinkedIn, Slack, Telegram, Discord) and SEO bots (Google, Bing, Apple).
 *
 * WHY: article/category/company pages are static HTML shells whose <head>
 * ships "<title>Loading… · Karostartup</title>" with an empty description and
 * NO og:* tags — the real meta is set client-side by setMeta() in app.js AFTER
 * the Supabase fetch. Link-preview crawlers do NOT run JS, so they saw the
 * placeholder + the favicon logo.
 *
 * HOW: matched to EXACTLY the three view routes. For a recognised CRAWLER it
 * reads ?slug=, fetches that one row (anon REST, RLS-safe), reads the static
 * shell from the bundle, injects the real <title> + og:/twitter:/canonical/
 * JSON-LD into <head>, and returns the SAME shell as the response. For
 * EVERYONE ELSE (humans) it calls next() — the unchanged static file is served
 * from the edge cache, so there is ZERO added latency / Supabase load on human
 * pageviews, and app.js sets the meta client-side exactly as before. URLs and
 * the human render path are 100% untouched.
 *
 * Not cloaking: bots and humans get the SAME article; bots just get the meta in
 * the initial HTML that humans get via JS. Any error on the crawler path falls
 * back to next() (the static shell), so this can never 500 a live page.
 */
import { readFileSync } from 'node:fs';
import { next } from '@vercel/functions';

export const config = {
  runtime: 'nodejs',
  matcher: ['/article/view', '/category/view', '/company/view'],
};

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2d3B2cW1xbWlzb2ZmYm5uamRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODYyNTEsImV4cCI6MjA5NDI2MjI1MX0.ZYBWcOGiVKV9HM3Ho2GjJ-r4XJvMITvsEK7vlEFlzVw';
const REST = `${BASE}/rest/v1`;
const HEADERS = { apikey: ANON, Authorization: `Bearer ${ANON}`, Accept: 'application/json' };
const ORIGIN = 'https://www.karostartup.com';
const SITE_NAME = 'Karostartup';
const SITE_TWITTER = '@karo_startup';
const DEFAULT_OG_IMAGE = `${ORIGIN}/assets/logo-wordmark.png`;
const PUBLISHER_LOGO = `${ORIGIN}/assets/logo-wordmark.png`;

// Recognised link-preview + SEO crawlers (case-insensitive). Humans fall to next().
const CRAWLER = /(facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|redditbot|Applebot|Googlebot|Google-InspectionTool|bingbot|SkypeUriPreview|vkShare|Embedly|Iframely|W3C_Validator|Mastodon|nuzzel|Qwantify)/i;

const ROUTES = {
  '/article/view':  { table: 'articles',   select: 'slug,title,subtitle,summary,cover_image_url,published_at,updated_at,tags,categories(name,slug),profiles!author_id(full_name)', published: true },
  '/category/view': { table: 'categories', select: 'slug,name,description', published: false },
  '/company/view':  { table: 'companies',  select: 'slug,name,description,logo_url,sector', published: false },
};

// Static literal new URL(...) so Vercel's File Trace bundles the shells.
function read(u) { try { return readFileSync(u, 'utf8'); } catch { return null; } }
const SHELLS = {
  '/article/view':  read(new URL('./article/view.html', import.meta.url)),
  '/category/view': read(new URL('./category/view.html', import.meta.url)),
  '/company/view':  read(new URL('./company/view.html', import.meta.url)),
};

// ---- helpers ----
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function plainText(s) {
  if (!s) return '';
  let t = String(s).replace(/<[^>]*>/g, ' ');
  t = t.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
  return t.replace(/\s+/g, ' ').trim();
}
function truncate(s, n) {
  s = String(s || '');
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}
function abs(url) {
  if (!url) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(url)) return url;
  return ORIGIN + (url.startsWith('/') ? url : '/' + url);
}
// Force a WhatsApp/FB-safe JPEG at 1.91:1; replace an existing Cloudinary
// transform without clobbering the version segment.
export function ogImage(url) {
  if (!url) return DEFAULT_OG_IMAGE;
  if (!/res\.cloudinary\.com/.test(url)) return abs(url);
  const T = 'f_jpg,w_1200,h_630,c_fill,g_auto,q_auto:good';
  const marker = '/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  let rest = url.slice(i + marker.length);
  const cut = rest.indexOf('/');
  const firstSeg = cut === -1 ? rest : rest.slice(0, cut);
  const isVersion = /^v\d+$/.test(firstSeg);
  const looksLikeTransform = /[,_]/.test(firstSeg) && !isVersion && !/\.\w+$/.test(firstSeg);
  if (looksLikeTransform && cut !== -1) rest = rest.slice(cut + 1);
  return url.slice(0, i) + marker + T + '/' + rest;
}
function metaTag(prop, content, name) {
  if (content == null || content === '') return '';
  const attr = name ? `name="${name}"` : `property="${prop}"`;
  return `<meta ${attr} content="${esc(content)}">`;
}

function buildMeta(path, row, slug) {
  const canon = `${ORIGIN}${path}?slug=${encodeURIComponent(slug)}`;
  const lines = [];
  let title, desc, img, ogType, twCard;
  if (path === '/article/view') {
    title = row.title || SITE_NAME;
    desc = truncate(plainText(row.summary) || row.subtitle || row.title || '', 200);
    img = ogImage(row.cover_image_url);
    ogType = 'article'; twCard = 'summary_large_image';
  } else if (path === '/category/view') {
    title = row.name || SITE_NAME;
    desc = truncate(plainText(row.description) || `${row.name} — the latest from ${SITE_NAME}.`, 200);
    img = DEFAULT_OG_IMAGE; ogType = 'website'; twCard = 'summary_large_image';
  } else {
    title = row.name || SITE_NAME;
    desc = truncate(plainText(row.description) || `${row.name} — company profile, funding history, and coverage on ${SITE_NAME}.`, 200);
    img = ogImage(row.logo_url); ogType = 'website'; twCard = img === DEFAULT_OG_IMAGE ? 'summary' : 'summary_large_image';
  }
  const fullTitle = `${title} · ${SITE_NAME}`;
  const isCloudinaryJpg = /res\.cloudinary\.com/.test(img);

  lines.push(`<link rel="canonical" href="${esc(canon)}">`);
  lines.push(`<meta name="robots" content="index,follow,max-image-preview:large">`);
  lines.push(metaTag('og:site_name', SITE_NAME));
  lines.push(metaTag('og:locale', 'en_IN'));
  lines.push(metaTag('og:type', ogType));
  lines.push(metaTag('og:url', canon));
  lines.push(metaTag('og:title', title));
  lines.push(metaTag('og:description', desc));
  lines.push(metaTag('og:image', img));
  lines.push(metaTag('og:image:secure_url', img));
  if (isCloudinaryJpg) {
    lines.push(metaTag('og:image:type', 'image/jpeg'));
    lines.push(metaTag('og:image:width', '1200'));
    lines.push(metaTag('og:image:height', '630'));
  }
  lines.push(metaTag('og:image:alt', title));
  lines.push(metaTag('twitter:card', twCard, 'twitter:card'));
  lines.push(metaTag('twitter:site', SITE_TWITTER, 'twitter:site'));
  lines.push(metaTag('twitter:title', title, 'twitter:title'));
  lines.push(metaTag('twitter:description', desc, 'twitter:description'));
  lines.push(metaTag('twitter:image', img, 'twitter:image'));

  if (path === '/article/view') {
    if (row.published_at) lines.push(metaTag('article:published_time', row.published_at));
    if (row.updated_at || row.published_at) lines.push(metaTag('article:modified_time', row.updated_at || row.published_at));
    if (row.categories?.name) lines.push(metaTag('article:section', row.categories.name));
    for (const tag of (Array.isArray(row.tags) ? row.tags : [])) lines.push(metaTag('article:tag', tag));
    const jsonLd = {
      '@context': 'https://schema.org', '@type': 'NewsArticle',
      headline: title, description: desc, image: img ? [img] : undefined,
      datePublished: row.published_at || undefined,
      dateModified: row.updated_at || row.published_at || undefined,
      author: row.profiles?.full_name ? { '@type': 'Person', name: row.profiles.full_name } : undefined,
      publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: PUBLISHER_LOGO } },
      mainEntityOfPage: canon, articleSection: row.categories?.name || undefined,
    };
    lines.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`);
  }
  return { fullTitle, desc, block: lines.filter(Boolean).join('\n  ') };
}

function inject(shell, fullTitle, desc, block) {
  return shell
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(fullTitle)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*>/, `<meta name="description" content="${esc(desc)}">`)
    .replace('</head>', `  ${block}\n</head>`);
}

// Per-instance memo so repeated crawler hits don't re-query Supabase.
const META_CACHE = new Map();
const TTL_MS = 600_000;
async function getRow(path, slug) {
  const cfg = ROUTES[path];
  const key = path + '|' + slug;
  const hit = META_CACHE.get(key);
  if (hit && hit.exp > Date.now()) return hit.v;
  let row = null;
  try {
    let q = `${REST}/${cfg.table}?slug=eq.${encodeURIComponent(slug)}&select=${encodeURIComponent(cfg.select)}&limit=1`;
    if (cfg.published) q += '&status=eq.published';
    const r = await fetch(q, { headers: HEADERS });
    if (r.ok) { const rows = await r.json(); row = (Array.isArray(rows) && rows[0]) || null; }
  } catch { row = null; }
  META_CACHE.set(key, { v: row, exp: Date.now() + TTL_MS });
  return row;
}

export default async function middleware(request) {
  let path, slug, ua;
  try {
    const url = new URL(request.url);
    path = url.pathname.replace(/\.html$/, '');
    slug = url.searchParams.get('slug');
    ua = request.headers.get('user-agent') || '';
  } catch { return next(); }

  // Humans (and anything not a known crawler) -> serve the real static file
  // unchanged (edge-cached, zero added latency); meta is set by app.js as today.
  if (!ROUTES[path] || !CRAWLER.test(ua)) return next();

  const shell = SHELLS[path];
  if (!shell || !slug) return next();

  const row = await getRow(path, slug);
  if (!row) return next();

  try {
    const { fullTitle, desc, block } = buildMeta(path, row, slug);
    return new Response(inject(shell, fullTitle, desc, block), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Crawlers cache on their own side; this is a light hint and harmless.
        'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return next();
  }
}
