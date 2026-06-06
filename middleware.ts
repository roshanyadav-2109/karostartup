/**
 * Vercel Routing Middleware (EDGE-safe) — two jobs:
 *
 * 1) SOCIAL OG META (Tier-0, live): for the 3 query-param view routes
 *    (/article/view, /category/view, /company/view), when a no-JS SOCIAL crawler
 *    requests them, return a small self-contained OG-only HTML so link previews
 *    show the real title/description/image. Humans + Google/Bing get next().
 *
 * 2) OLD-URL RECOVERY (Tier-2): the site migrated from a WordPress site whose
 *    article URLs were root /<slug>. Those 404 today. Here we:
 *      - 301 an OLD root /<slug> to the live /article/view?slug=<slug>, but ONLY
 *        after an existence check (so dead slugs 404 cleanly, never a soft-404),
 *      - 410 Gone the dead WordPress junk: /wp-content,/wp-includes,/author,
 *        /20YY[/MM], and /tag (except the 2 tags that equal a real category).
 *
 * HARD SAFETY RULES (this middleware runs on nearly every request now):
 *   - ZERO new top-level imports beyond @vercel/functions. A prior node:fs
 *     import caused a module-LOAD failure (MIDDLEWARE_INVOCATION_FAILED 500) that
 *     try/catch CANNOT catch; with the widened matcher that would be site-wide.
 *     So: globals only (fetch, Response, AbortController, URL, RegExp, Set).
 *   - Reserved-path checks run BEFORE any DB call, so the homepage, static pages
 *     and known routes never hit Supabase and pass straight through.
 *   - Every Supabase lookup has an AbortController timeout so a slow/down DB can
 *     never hang a request — it degrades to next() (today's behavior).
 *   - The whole handler is wrapped in try/catch → next().
 *   Rollback: shrink `config.matcher` back to the 3 view routes (article/category/company).
 */
import { next } from '@vercel/functions';

export const config = {
  // Run on everything EXCEPT static assets / api / the homepage data file, so we
  // can see old root /<slug>, /tag, /author, /wp-content, /20YY paths. The 3
  // the 3 view OG routes are included. (Reserved paths still pass through in-handler.)
  matcher: ['/((?!api/|_next/|assets/|data/|favicon.ico|robots.txt|sitemap.xml).*)'],
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

const SOCIAL_CRAWLER = /(facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|Slack-ImgProxy|TelegramBot|Discordbot|Pinterest|redditbot|vkShare|SkypeUriPreview|Embedly|Iframely|Mastodon|nuzzel|Qwantify)/i;

const ROUTES: Record<string, { table: string; select: string; published: boolean }> = {
  '/article/view':  { table: 'articles',   select: 'slug,title,subtitle,summary,cover_image_url,published_at,updated_at,tags,categories(name,slug),profiles!author_id(full_name)', published: true },
  '/category/view': { table: 'categories', select: 'slug,name,description', published: false },
  '/company/view':  { table: 'companies',  select: 'slug,name,description,logo_url,sector', published: false },
};

// Single-segment paths that must NEVER be treated as an old article slug (real
// pages, route prefixes, files). Root /<slug> recovery skips these (→ next()).
const RESERVED = new Set([
  'article', 'category', 'company', 'admin', 'auth', 'assets', 'api', 'data', '_next', '.well-known',
  'best-brands', 'newsletters', 'podcasts', 'plus', 'share-your-startup', 'internship', 'contact',
  'privacy', 'terms', 'cookies', 'features', 'search', 'neural-ai', 'profile', 'index', '404',
  'sitemap.xml', 'robots.txt', 'favicon.ico', 'sitemap', 'manifest.json', 'auth',
  // old sections already 308'd by vercel.json before middleware runs (belt-and-suspenders)
  'general', 'news', 'press-release', 'success-stories', 'startup-news', 'startup-stories',
  'business-models', 'funding', 'ipo', 'technology', 'innovation', 'marketing', 'products',
  'finance', 'growth', 'founder-interviews', 'case-studies', 'tech-updates', 'trends', 'web-stories', 'tag', 'author',
]);

// ---------- responses ----------
function gone() {
  return new Response('410 Gone', {
    status: 410,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' },
  });
}
function redir(location: string) {
  return new Response(null, { status: 301, headers: { Location: location, 'cache-control': 'public, max-age=86400' } });
}

// ---------- Supabase helpers (always timeout-bounded) ----------
async function fetchJson(qs: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 800); // never hang a request on a slow DB
  try {
    const r = await fetch(`${REST}/${qs}`, { headers: HEADERS, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
async function articleExists(slug: string) {
  const rows = await fetchJson(`articles?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=slug&limit=1`);
  return Array.isArray(rows) && rows.length > 0;
}
async function getRow(path: string, slug: string) {
  const cfg = ROUTES[path];
  let qs = `${cfg.table}?slug=eq.${encodeURIComponent(slug)}&select=${encodeURIComponent(cfg.select)}&limit=1`;
  if (cfg.published) qs += '&status=eq.published';
  const rows = await fetchJson(qs);
  return (Array.isArray(rows) && rows[0]) || null;
}

// ---------- OG head builder (unchanged) ----------
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

export default async function middleware(request: Request) {
  try {
    const url = new URL(request.url);
    const rawPath = url.pathname;
    const path = rawPath.replace(/\.html$/, '');

    // ---- 1) The 3 query-param view routes: OG for crawlers, else pass through ----
    if (ROUTES[path]) {
      const slug = url.searchParams.get('slug');
      const ua = request.headers.get('user-agent') || '';
      if (slug && SOCIAL_CRAWLER.test(ua)) {
        const row = await getRow(path, slug);
        if (row) {
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
        }
      }
      return next();
    }

    // ---- 2) 410 Gone — dead WordPress assets / taxonomy / date archives ----
    if (/^\/wp-(content|includes)\//i.test(rawPath)) return gone();
    if (/^\/author\//i.test(rawPath)) return gone();
    if (/^\/20\d{2}(\/(0[1-9]|1[0-2]))?\/?$/.test(rawPath)) return gone();
    const tagM = rawPath.match(/^\/tag\/([^/]+)\/?$/i);
    if (tagM) {
      const t = tagM[1].toLowerCase();
      if (t === 'fintech' || t === 'funding') return redir(`${ORIGIN}/category/view?slug=${t}`);
      return gone();
    }

    // ---- 3) Old root /<slug> recovery — existence-checked 301 ----
    const seg = rawPath.replace(/^\/+/, '').replace(/\/+$/, '');
    if (seg && !seg.includes('/') && !RESERVED.has(seg.toLowerCase())) {
      if (await articleExists(seg)) {
        return redir(`${ORIGIN}/article/view?slug=${encodeURIComponent(seg)}`);
      }
      return next(); // unknown single-segment slug → let it 404 (no soft-404, no blind redirect)
    }

    // ---- 4) homepage, static pages, multi-segment unknowns → unchanged ----
    return next();
  } catch {
    return next();
  }
}
