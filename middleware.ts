/**
 * Vercel Routing Middleware — server-side Open Graph for link-preview crawlers.
 *
 * BACKGROUND: article/category/company pages are static shells whose meta is set
 * client-side by app.js after a Supabase fetch. No-JS preview crawlers (WhatsApp,
 * Facebook, etc.) therefore saw "<title>Loading…</title>" + the favicon.
 *
 * A previous attempt read the page shells with `node:fs` at module load; Vercel
 * ran the middleware on the EDGE runtime where node:fs doesn't exist, so the
 * module failed to load → MIDDLEWARE_INVOCATION_FAILED (500) on EVERY request.
 *
 * THIS VERSION IS EDGE-SAFE: it uses ONLY global fetch + string building — no
 * node:* imports, no file reads, nothing runtime-specific. For a recognised
 * SOCIAL crawler it returns a small, self-contained OG-only HTML document (the
 * crawler only reads <head> meta, never the body). For EVERYONE ELSE — humans,
 * Googlebot/Bing (which render JS and need the real body), missing slug, or ANY
 * error — it calls next(), so the unchanged static file is served exactly as
 * today. The whole handler is wrapped in try/catch → next(), so it can never
 * 500 a page. URLs and the human render path are untouched.
 */
import { next } from '@vercel/functions';

export const config = {
  matcher: ['/article/view', '/category/view', '/company/view'],
};

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2d3B2cW1xbWlzb2ZmYm5uamRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODYyNTEsImV4cCI6MjA5NDI2MjI1MX0.ZYBWcOGiVKV9HM3Ho2GjJ-r4XJvMITvsEK7vlEFlzVw';
const REST = `${BASE}/rest/v1`;
const HEADERS = { apikey: ANON, Authorization: `Bearer ${ANON}`, Accept: 'application/json' };
const ORIGIN = 'https://www.karostartup.com';
const SITE_NAME = 'Karostartup';
const SITE_TWITTER = '@karo_startup';
const DEFAULT_OG_IMAGE = `${ORIGIN}/assets/logo-wordmark.png`;
const PUBLISHER_LOGO = `${ORIGIN}/assets/logo-wordmark.png`;

// No-JS SOCIAL preview crawlers only. Googlebot/Bing/Applebot are deliberately
// EXCLUDED — they render JS / index the body, so they fall through to next()
// and get the full static page (real meta via app.js), avoiding a bodyless page.
const SOCIAL_CRAWLER = /(facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|Slack-ImgProxy|TelegramBot|Discordbot|Pinterest|redditbot|vkShare|SkypeUriPreview|Embedly|Iframely|Mastodon|nuzzel|Qwantify)/i;

const ROUTES: Record<string, { table: string; select: string; published: boolean }> = {
  '/article/view':  { table: 'articles',   select: 'slug,title,subtitle,summary,cover_image_url,published_at,updated_at,tags,categories(name,slug),profiles!author_id(full_name)', published: true },
  '/category/view': { table: 'categories', select: 'slug,name,description', published: false },
  '/company/view':  { table: 'companies',  select: 'slug,name,description,logo_url,sector', published: false },
};

function esc(s: any) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function plainText(s: any) {
  if (!s) return '';
  let t = String(s).replace(/<[^>]*>/g, ' ');
  t = t.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
  return t.replace(/\s+/g, ' ').trim();
}
function truncate(s: any, n: number) {
  s = String(s || '');
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}
function abs(url: string) {
  if (!url) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(url)) return url;
  return ORIGIN + (url.startsWith('/') ? url : '/' + url);
}
// Force a WhatsApp/FB-safe JPEG at 1.91:1; replace any existing Cloudinary
// transform without clobbering the version segment.
function ogImage(url: string) {
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
function metaTag(prop: string, content: any, name?: string) {
  if (content == null || content === '') return '';
  const attr = name ? `name="${name}"` : `property="${prop}"`;
  return `<meta ${attr} content="${esc(content)}">`;
}

function buildHead(path: string, row: any, slug: string) {
  const canon = `${ORIGIN}${path}?slug=${encodeURIComponent(slug)}`;
  let title: string, desc: string, img: string, ogType: string, twCard: string;
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
  const L: string[] = [];
  L.push(`<title>${esc(fullTitle)}</title>`);
  L.push(metaTag('description', desc, 'description'));
  L.push(`<link rel="canonical" href="${esc(canon)}">`);
  L.push(`<meta name="robots" content="index,follow,max-image-preview:large">`);
  L.push(metaTag('og:site_name', SITE_NAME));
  L.push(metaTag('og:locale', 'en_IN'));
  L.push(metaTag('og:type', ogType));
  L.push(metaTag('og:url', canon));
  L.push(metaTag('og:title', title));
  L.push(metaTag('og:description', desc));
  L.push(metaTag('og:image', img));
  L.push(metaTag('og:image:secure_url', img));
  if (isCloudinaryJpg) {
    L.push(metaTag('og:image:type', 'image/jpeg'));
    L.push(metaTag('og:image:width', '1200'));
    L.push(metaTag('og:image:height', '630'));
  }
  L.push(metaTag('og:image:alt', title));
  L.push(metaTag('twitter:card', twCard, 'twitter:card'));
  L.push(metaTag('twitter:site', SITE_TWITTER, 'twitter:site'));
  L.push(metaTag('twitter:title', title, 'twitter:title'));
  L.push(metaTag('twitter:description', desc, 'twitter:description'));
  L.push(metaTag('twitter:image', img, 'twitter:image'));
  if (path === '/article/view') {
    if (row.published_at) L.push(metaTag('article:published_time', row.published_at));
    if (row.updated_at || row.published_at) L.push(metaTag('article:modified_time', row.updated_at || row.published_at));
    if (row.categories?.name) L.push(metaTag('article:section', row.categories.name));
    for (const tag of (Array.isArray(row.tags) ? row.tags : [])) L.push(metaTag('article:tag', tag));
    const jsonLd: any = {
      '@context': 'https://schema.org', '@type': 'NewsArticle',
      headline: title, description: desc, image: img ? [img] : undefined,
      datePublished: row.published_at || undefined,
      dateModified: row.updated_at || row.published_at || undefined,
      author: row.profiles?.full_name ? { '@type': 'Person', name: row.profiles.full_name } : undefined,
      publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: PUBLISHER_LOGO } },
      mainEntityOfPage: canon, articleSection: row.categories?.name || undefined,
    };
    L.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`);
  }
  return { title, headHtml: L.filter(Boolean).join('\n  ') };
}

async function getRow(path: string, slug: string) {
  const cfg = ROUTES[path];
  let q = `${REST}/${cfg.table}?slug=eq.${encodeURIComponent(slug)}&select=${encodeURIComponent(cfg.select)}&limit=1`;
  if (cfg.published) q += '&status=eq.published';
  const r = await fetch(q, { headers: HEADERS });
  if (!r.ok) return null;
  const rows = await r.json();
  return (Array.isArray(rows) && rows[0]) || null;
}

export default async function middleware(request: Request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\.html$/, '');
    const slug = url.searchParams.get('slug');
    const ua = request.headers.get('user-agent') || '';

    // Only intercept for recognised SOCIAL crawlers with a slug; everyone else
    // (humans, Google/Bing, no slug) gets the unchanged static file.
    if (!ROUTES[path] || !slug || !SOCIAL_CRAWLER.test(ua)) return next();

    const row = await getRow(path, slug);
    if (!row) return next();

    const { title, headHtml } = buildHead(path, row, slug);
    const html = `<!doctype html><html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${headHtml}
</head><body><h1>${esc(title)}</h1></body></html>`;
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return next();
  }
}
