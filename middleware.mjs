/**
 * Vercel Routing Middleware (Node runtime) — server-side Open Graph / meta
 * injection for link previews (WhatsApp, Facebook, Twitter/X, LinkedIn, Slack,
 * Telegram, Discord) AND first-wave SEO.
 *
 * WHY: article/category/company pages are static HTML shells whose <head>
 * ships "<title>Loading… · Karostartup</title>" with an empty description and
 * NO og:* tags — the real meta is set client-side by setMeta() in app.js AFTER
 * the Supabase fetch. Link-preview crawlers do NOT run JS, so they see the
 * placeholder + the favicon logo. This middleware runs BEFORE the static
 * filesystem layer, fetches the entity by ?slug= (anon REST, RLS-safe), and
 * returns the SAME shell with the real <title> + og:/twitter:/JSON-LD injected
 * into <head>. The body is byte-identical otherwise, so the human client-render
 * path and the /…/view?slug= URLs are 100% unchanged; app.js's own setMeta()
 * just re-sets the (now already-correct) tags for browsers.
 *
 * Served to EVERYONE (no UA sniffing, no Vary) so it stays CDN-cacheable and is
 * not cloaking — which also fixes Google. Response carries an aggressive CDN
 * cache (s-maxage) so the function stays cold and Supabase is barely touched;
 * an in-instance memo additionally protects Supabase egress on warm instances.
 */
import { readFileSync } from 'node:fs';

export const config = {
  runtime: 'nodejs',
  // EXACTLY the three view routes — nothing else is ever intercepted
  // (homepage, /assets/*, /api/*, /data/*, 404, redirect sources all skip this).
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

// Per-route config: which shell file, which table, and the select list.
const ROUTES = {
  '/article/view': {
    file: 'article/view.html',
    table: 'articles',
    select: 'slug,title,subtitle,summary,cover_image_url,published_at,updated_at,tags,categories(name,slug),profiles!author_id(full_name)',
    published: true, // RLS public filter — never leak draft/hidden(PIB) meta
  },
  '/category/view': {
    file: 'category/view.html',
    table: 'categories',
    select: 'slug,name,description',
    published: false,
  },
  '/company/view': {
    file: 'company/view.html',
    table: 'companies',
    select: 'slug,name,description,logo_url,sector',
    published: false,
  },
};

// Read the three shells once at cold-start. new URL(...import.meta.url) is
// statically traceable by Vercel's bundler; includeFiles in vercel.json is the
// belt-and-suspenders. If a read fails the value is null -> pass-through.
const SHELLS = {};
for (const [path, cfg] of Object.entries(ROUTES)) {
  try { SHELLS[path] = readFileSync(new URL('./' + cfg.file, import.meta.url), 'utf8'); }
  catch { SHELLS[path] = null; }
}

// ---- helpers ----
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// strip HTML, decode the common entities, collapse whitespace (&amp; LAST).
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
// Force a WhatsApp/FB-safe JPEG at the 1.91:1 large-card size. Replaces an
// existing Cloudinary transform (e.g. f_auto,q_auto) WITHOUT clobbering the
// version segment; leaves non-Cloudinary URLs as absolute.
export function ogImage(url) {
  if (!url) return DEFAULT_OG_IMAGE;
  if (!/res\.cloudinary\.com/.test(url)) return abs(url);
  const T = 'f_jpg,w_1200,h_630,c_fill,g_auto,q_auto:good';
  const marker = '/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  let rest = url.slice(i + marker.length);          // "f_auto,q_auto/v123/..." OR "v123/..."
  const firstSeg = rest.slice(0, rest.indexOf('/') === -1 ? rest.length : rest.indexOf('/'));
  const isVersion = /^v\d+$/.test(firstSeg);
  const looksLikeTransform = /[,_]/.test(firstSeg) && !isVersion && !/\.\w+$/.test(firstSeg);
  if (looksLikeTransform && rest.indexOf('/') !== -1) rest = rest.slice(rest.indexOf('/') + 1);
  return url.slice(0, i) + marker + T + '/' + rest;
}

function metaTag(prop, content, name) {
  if (content == null || content === '') return '';
  const attr = name ? `name="${name}"` : `property="${prop}"`;
  return `<meta ${attr} content="${esc(content)}">`;
}

// Build the per-entity meta block + the (title, description) to substitute.
function buildMeta(path, row, slug) {
  const canon = `${ORIGIN}${path}?slug=${encodeURIComponent(slug)}`;
  const lines = [];
  let title, desc, img, ogType, twCard;

  if (path === '/article/view') {
    title = row.title || 'Karostartup';
    desc = truncate(plainText(row.summary) || row.subtitle || row.title || '', 200);
    img = ogImage(row.cover_image_url);
    ogType = 'article'; twCard = 'summary_large_image';
  } else if (path === '/category/view') {
    title = row.name || 'Karostartup';
    desc = truncate(plainText(row.description) || `${row.name} — the latest from Karostartup.`, 200);
    img = DEFAULT_OG_IMAGE;
    ogType = 'website'; twCard = 'summary_large_image';
  } else { // company
    title = row.name || 'Karostartup';
    desc = truncate(plainText(row.description) || `${row.name} — company profile, funding history, and coverage on Karostartup.`, 200);
    img = ogImage(row.logo_url);
    ogType = 'website'; twCard = img === DEFAULT_OG_IMAGE ? 'summary' : 'summary_large_image';
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
      headline: title, description: desc,
      image: img ? [img] : undefined,
      datePublished: row.published_at || undefined,
      dateModified: row.updated_at || row.published_at || undefined,
      author: row.profiles?.full_name ? { '@type': 'Person', name: row.profiles.full_name } : undefined,
      publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: PUBLISHER_LOGO } },
      mainEntityOfPage: canon,
      articleSection: row.categories?.name || undefined,
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

// ---- per-instance memo (protects Supabase egress even if the CDN doesn't cache) ----
const META_CACHE = new Map();
const TTL_MS = 600_000; // 10 min
async function fetchRow(path) {
  const cfg = ROUTES[path];
  return async function (slug) {
    const key = path + '|' + slug;
    const hit = META_CACHE.get(key);
    if (hit && hit.exp > Date.now()) return hit.v;
    let row = null;
    try {
      let q = `${REST}/${cfg.table}?slug=eq.${encodeURIComponent(slug)}&select=${encodeURIComponent(cfg.select)}&limit=1`;
      if (cfg.published) q += '&status=eq.published';
      const r = await fetch(q, { headers: HEADERS });
      if (r.ok) { const rows = await r.json(); row = Array.isArray(rows) && rows[0] ? rows[0] : null; }
    } catch { row = null; }
    META_CACHE.set(key, { v: row, exp: Date.now() + TTL_MS });
    return row;
  };
}

const CACHE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  'Vercel-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};

export default async function middleware(request) {
  let path, slug, shell;
  try {
    const url = new URL(request.url);
    path = url.pathname.replace(/\.html$/, '');           // be tolerant of /article/view.html
    slug = url.searchParams.get('slug');
    shell = SHELLS[path];
  } catch { return undefined; }

  // Shell unavailable (read failed at cold-start) -> let the static file serve.
  if (!shell || !ROUTES[path]) return undefined;
  // No slug -> serve the shell unmodified (client handles it); identical bytes.
  if (!slug) return new Response(shell, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

  const row = await (await fetchRow(path))(slug);
  // Not found / fetch error -> unmodified shell so the client shows its own not-found.
  if (!row) return new Response(shell, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

  // Inject; ANY error here falls back to the unmodified shell so a bug can
  // never 500 a live page — worst case the preview just isn't enriched.
  try {
    const { fullTitle, desc, block } = buildMeta(path, row, slug);
    const html = inject(shell, fullTitle, desc, block);
    return new Response(html, { status: 200, headers: CACHE_HEADERS });
  } catch {
    return new Response(shell, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}
