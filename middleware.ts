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
  matcher: ['/((?!api/|_next/|assets/|data/|favicon.ico|robots.txt|sitemap.xml|news-sitemap.xml).*)'],
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

// Search-engine crawlers. These render JS only on a deferred "second wave", and
// the raw article/view.html shell they'd otherwise get is an empty <title>Loading…
// page — so they index nothing. We hand them a fully server-rendered page (head +
// real article prose) so the content is indexable at crawl time. Googlebot also
// fronts AdsBot/Storebot/Image variants, hence the broad "Googlebot" match.
const SEARCH_CRAWLER = /(Googlebot|Google-InspectionTool|Bingbot|BingPreview|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|Applebot|GPTBot|OAI-SearchBot|PerplexityBot|ChatGPT-User|CCBot|Amazonbot|Bytespider)/i;

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
  // Articles use clean URLs (/article/<slug>); category/company stay on ?slug=.
  const canon = path === '/article/view'
    ? `${ORIGIN}/article/${encodeURIComponent(slug)}`
    : `${ORIGIN}${path}?slug=${encodeURIComponent(slug)}`;
  let title: string, desc: string, img: string, ogType: string, twCard: string;
  if (path === '/article/view') {
    title = row.title || SITE_NAME;
    desc = truncate(plainText(row.summary) || row.subtitle || row.title || '', 160);
    img = ogImage(row.cover_image_url);
    ogType = 'article'; twCard = 'summary_large_image';
  } else if (path === '/category/view') {
    title = row.name || SITE_NAME;
    desc = truncate(plainText(row.description) || `${row.name} — the latest from ${SITE_NAME}.`, 160);
    img = DEFAULT_OG_IMAGE; ogType = 'website'; twCard = 'summary_large_image';
  } else {
    title = row.name || SITE_NAME;
    desc = truncate(plainText(row.description) || `${row.name} — company profile, funding history, and coverage on ${SITE_NAME}.`, 160);
    img = ogImage(row.logo_url); ogType = 'website'; twCard = img === DEFAULT_OG_IMAGE ? 'summary' : 'summary_large_image';
  }
  // Keep <title> inside Google's ~65-char display window: append the brand only
  // when it still fits, otherwise trim the headline at a word boundary. (The full
  // headline is preserved in <h1>, og:title and JSON-LD headline.)
  const BRAND = ` · ${SITE_NAME}`;
  const fullTitle = (title.length + BRAND.length) <= 65 ? `${title}${BRAND}` : truncate(title, 65);
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
    const catName = row.categories?.name;
    const catSlug = row.categories?.slug;
    const crumbs: any[] = [{ '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN }];
    if (catName && catSlug) {
      crumbs.push({ '@type': 'ListItem', position: 2, name: catName, item: `${ORIGIN}/category/view?slug=${encodeURIComponent(catSlug)}` });
    }
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: truncate(title, 110), item: canon });
    const tags = Array.isArray(row.tags) ? row.tags : [];
    const jsonLd: any = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'NewsArticle',
          headline: truncate(title, 110), // Google caps NewsArticle headline at ~110 chars
          description: desc, image: img ? [img] : undefined,
          datePublished: row.published_at || undefined,
          dateModified: row.updated_at || row.published_at || undefined,
          author: row.profiles?.full_name ? { '@type': 'Person', name: row.profiles.full_name } : undefined,
          publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: PUBLISHER_LOGO } },
          mainEntityOfPage: canon, articleSection: catName || undefined,
          keywords: tags.length ? tags.join(', ') : undefined,
          inLanguage: 'en-IN',
          isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: ORIGIN },
        },
        { '@type': 'BreadcrumbList', itemListElement: crumbs },
      ],
    };
    L.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`);
  }
  return { title, headHtml: L.filter(Boolean).join('\n  ') };
}

// ---------- full-article SSR for search engines ----------
// Fetch the article WITH its body content (the OG path deliberately omits it to
// keep social payloads tiny). Timeout-bounded like every other DB call here.
async function getArticleFull(slug: string) {
  const select = 'slug,title,subtitle,kicker,summary,content,cover_image_url,cover_caption,published_at,updated_at,tags,categories(name,slug),profiles!author_id(full_name)';
  const rows = await fetchJson(`articles?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=${encodeURIComponent(select)}&limit=1`);
  return (Array.isArray(rows) && rows[0]) || null;
}

// Minimal, dependency-free markdown→HTML. Good enough for indexing: emits real
// headings, paragraphs, lists and links so the prose is machine-readable. Legacy
// imported articles are already HTML — detect and pass those through untouched.
function mdToHtml(src: any) {
  const raw = String(src || '')
    // Strip Office/Word paste cruft: mso conditional comments (which wrap the
    // <xml><w:…> block containing "MicrosoftInternetExplorer4"), stray <xml>
    // blocks, <style> blocks, and o:/w: namespace tags. Keeps SSR output clean.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<xml[\s\S]*?<\/xml>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?[ovw]:[^>]*>/gi, '');
  if (!raw.trim()) return '';
  // Already HTML (legacy WordPress import) → trust it; crawlers don't execute it.
  if (/<(p|h[1-6]|ul|ol|li|div|br|img|blockquote|table)\b/i.test(raw)) return raw;

  const inline = (s: string) =>
    esc(s)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `<a href="${esc(u)}">${t}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list.length) { out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`); list = []; } };
  for (const ln of lines) {
    const line = ln.trim();
    if (!line) { flushPara(); flushList(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); flushList(); const lvl = Math.min(h[1].length + 1, 6); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }
    if (/^[-*]\s+/.test(line)) { flushPara(); list.push(line.replace(/^[-*]\s+/, '')); continue; }
    if (/^>\s+/.test(line)) { flushPara(); flushList(); out.push(`<blockquote>${inline(line.replace(/^>\s+/, ''))}</blockquote>`); continue; }
    if (/^---+$/.test(line)) { flushPara(); flushList(); continue; }
    flushList(); para.push(line);
  }
  flushPara(); flushList();
  return out.join('\n');
}

// A complete, indexable HTML document: real <head> meta (reused from buildHead) +
// real article prose in <body>. Mirrors what users eventually see client-side, so
// this is dynamic rendering, not cloaking.
function buildArticlePage(row: any, slug: string) {
  const { title, headHtml } = buildHead('/article/view', row, slug);
  const kicker = row.kicker ? `<p class="kicker">${esc(row.kicker)}</p>` : '';
  const sub = row.subtitle ? `<p class="article-subtitle">${esc(row.subtitle)}</p>` : '';
  const byline = row.profiles?.full_name ? `<p class="byline">By ${esc(row.profiles.full_name)}</p>` : '';
  const cover = row.cover_image_url
    ? `<figure><img src="${esc(abs(row.cover_image_url))}" alt="${esc(row.cover_caption || title)}">${row.cover_caption ? `<figcaption>${esc(row.cover_caption)}</figcaption>` : ''}</figure>`
    : '';
  // Body images imported from WordPress/Word often have no alt attribute. Fall
  // back to the headline so every image carries descriptive, indexable alt text.
  const body = mdToHtml(row.content)
    .replace(/<img(?![^>]*\salt\s*=)([^>]*?)\/?>/gi, (_m: string, attrs: string) => `<img${attrs} alt="${esc(title)}">`);
  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${headHtml}
  <link rel="stylesheet" href="/assets/style.css">
</head><body>
  <article>
    ${kicker}
    <h1>${esc(title)}</h1>
    ${sub}
    ${byline}
    ${cover}
    ${body}
  </article>
</body></html>`;
}

// ---------- hub-page SSR (category / company) ----------
// These routes previously served crawlers a head-only page with a bare <h1> —
// ~1 word of indexable content, i.e. a thin/doorway page. Now they render the
// real article list, which also gives every article a crawlable internal link
// (so anything published later is discovered automatically).

function htmlResponse(html: string) {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}

async function getCategoryFull(slug: string) {
  const rows = await fetchJson(`categories?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name,description&limit=1`);
  const cat = (Array.isArray(rows) && rows[0]) || null;
  if (!cat) return null;
  const arts = await fetchJson(`articles?category_id=eq.${encodeURIComponent(cat.id)}&status=eq.published&select=slug,title,summary,published_at&order=published_at.desc&limit=100`);
  return { cat, articles: Array.isArray(arts) ? arts : [] };
}

async function getCompanyFull(slug: string) {
  const rows = await fetchJson(`companies?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name,description,logo_url,sector&limit=1`);
  const co = (Array.isArray(rows) && rows[0]) || null;
  if (!co) return null;
  const j = await fetchJson(`article_companies?company_id=eq.${encodeURIComponent(co.id)}&select=articles(slug,title,summary,published_at)&limit=100`);
  const articles = (Array.isArray(j) ? j.map((x: any) => x && x.articles).filter(Boolean) : [])
    .sort((a: any, b: any) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
  return { co, articles };
}

function articleListHtml(articles: any[]) {
  if (!articles.length) return '';
  const items = articles.map((a) => {
    const url = `${ORIGIN}/article/${encodeURIComponent(a.slug)}`;
    const ex = truncate(plainText(a.summary), 180);
    const day = a.published_at ? String(a.published_at).slice(0, 10) : '';
    const time = day ? `<time datetime="${esc(a.published_at)}">${esc(day)}</time>` : '';
    return `    <li>
      <h2><a href="${esc(url)}">${esc(a.title || a.slug)}</a></h2>
      ${time}
      ${ex ? `<p>${esc(ex)}</p>` : ''}
    </li>`;
  }).join('\n');
  return `  <ul>\n${items}\n  </ul>`;
}

function itemListLd(articles: any[], name: string) {
  return {
    '@type': 'ItemList', name,
    numberOfItems: articles.length,
    itemListElement: articles.slice(0, 100).map((a, i) => ({
      '@type': 'ListItem', position: i + 1,
      url: `${ORIGIN}/article/${encodeURIComponent(a.slug)}`,
      name: a.title || a.slug,
    })),
  };
}

function breadcrumbLd(trail: Array<{ name: string; url: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: t.url })),
  };
}

function hubPage(opts: {
  canon: string; fullTitle: string; heading: string; desc: string;
  intro: string; articles: any[]; ld: any[]; image?: string;
}) {
  const img = opts.image || DEFAULT_OG_IMAGE;
  const head = [
    `<title>${esc(opts.fullTitle)}</title>`,
    metaTag('description', opts.desc, 'description'),
    `<link rel="canonical" href="${esc(opts.canon)}">`,
    `<meta name="robots" content="index,follow,max-image-preview:large">`,
    metaTag('og:site_name', SITE_NAME), metaTag('og:locale', 'en_IN'),
    metaTag('og:type', 'website'), metaTag('og:url', opts.canon),
    metaTag('og:title', opts.heading), metaTag('og:description', opts.desc), metaTag('og:image', img),
    metaTag('twitter:card', 'summary_large_image', 'twitter:card'),
    metaTag('twitter:site', SITE_TWITTER, 'twitter:site'),
    metaTag('twitter:title', opts.heading, 'twitter:title'),
    metaTag('twitter:description', opts.desc, 'twitter:description'),
    metaTag('twitter:image', img, 'twitter:image'),
    `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': opts.ld }).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n  ');
  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${head}
  <link rel="stylesheet" href="/assets/style.css">
</head><body>
  <h1>${esc(opts.heading)}</h1>
  ${opts.intro ? `<p>${esc(opts.intro)}</p>` : ''}
${articleListHtml(opts.articles)}
</body></html>`;
}

function buildCategoryPage(cat: any, articles: any[], slug: string) {
  const canon = `${ORIGIN}/category/view?slug=${encodeURIComponent(slug)}`;
  const name = cat.name || slug;
  const heading = `${name} News, Funding & Analysis`;
  const base = plainText(cat.description);
  const desc = truncate(
    base
      ? `${base} Latest ${name} news, funding rounds, startup launches and analysis from India — updated daily on ${SITE_NAME}.`
      : `Latest ${name} news, funding rounds, startup launches and in-depth analysis from India's startup ecosystem, updated daily on ${SITE_NAME}.`,
    160);
  const intro = base
    ? `${base} Browse ${articles.length} ${name} stories covering Indian startups, funding rounds, founders and market trends.`
    : `Browse ${articles.length} ${name} stories covering Indian startups, funding rounds, founders and market trends.`;
  return hubPage({
    canon, fullTitle: `${heading} · ${SITE_NAME}`, heading, desc, intro, articles,
    ld: [
      { '@type': 'CollectionPage', name: heading, description: desc, url: canon, isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: ORIGIN } },
      itemListLd(articles, heading),
      breadcrumbLd([{ name: 'Home', url: ORIGIN }, { name, url: canon }]),
    ],
  });
}

function buildCompanyPage(co: any, articles: any[], slug: string) {
  const canon = `${ORIGIN}/company/view?slug=${encodeURIComponent(slug)}`;
  const name = co.name || slug;
  const sector = co.sector ? ` ${co.sector}` : '';
  const heading = `${name} — Company Profile, Funding & News`;
  const base = plainText(co.description);
  const desc = truncate(
    base
      ? `${base} ${name} funding rounds, investors, founders and latest news on ${SITE_NAME}.`
      : `${name}${sector ? ` is an Indian${sector} company.` : '.'} Company profile, funding history, investors, founders and latest news coverage on ${SITE_NAME}.`,
    160);
  const intro = base
    ? `${base} Track ${name}'s funding rounds, investors and latest coverage below.`
    : `Track ${name}'s funding rounds, investors, founders and latest news coverage below.`;
  return hubPage({
    canon, fullTitle: `${heading} · ${SITE_NAME}`, heading, desc, intro, articles,
    image: co.logo_url ? abs(co.logo_url) : undefined,
    ld: [
      { '@type': 'Organization', name, description: base || undefined, url: canon, logo: co.logo_url ? abs(co.logo_url) : undefined },
      articles.length ? itemListLd(articles, `${name} news`) : null,
      breadcrumbLd([{ name: 'Home', url: ORIGIN }, { name, url: canon }]),
    ].filter(Boolean),
  });
}

async function getLatestArticles(limit: number) {
  const arts = await fetchJson(`articles?status=eq.published&select=slug,title,summary,published_at&order=published_at.desc&limit=${limit}`);
  return Array.isArray(arts) ? arts : [];
}

// The homepage is client-rendered, so crawlers saw ~142 words and no links to
// any article. SSR the latest headlines for them: the single strongest internal
// -linking hub on the site, and the fastest path for new posts to be discovered.
function buildHomePage(articles: any[]) {
  const canon = `${ORIGIN}/`;
  const heading = 'Indian Startup News, Funding Rounds & Business Analysis';
  const desc = truncate(`${SITE_NAME} — founder-first business journalism covering Indian startups, funding rounds, deals, founders, fintech, SaaS and the economy. Updated daily.`, 160);
  const intro = `The latest ${articles.length} stories on Indian startups, funding rounds, founders, fintech, SaaS, D2C and AI from the ${SITE_NAME} newsroom.`;
  return hubPage({
    canon,
    fullTitle: `${SITE_NAME} · India's Business of Business`,
    heading, desc, intro, articles,
    ld: [
      {
        '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: SITE_NAME, url: ORIGIN,
        logo: { '@type': 'ImageObject', url: PUBLISHER_LOGO },
        sameAs: [`https://twitter.com/${SITE_TWITTER.replace('@', '')}`],
      },
      {
        '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: SITE_NAME, url: ORIGIN,
        publisher: { '@id': `${ORIGIN}/#organization` }, inLanguage: 'en-IN',
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${ORIGIN}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
      itemListLd(articles, 'Latest stories'),
    ],
  });
}

export default async function middleware(request: Request) {
  try {
    const url = new URL(request.url);
    const rawPath = url.pathname;
    const path = rawPath.replace(/\.html$/, '');

    // ---- 0a) Homepage: SSR the latest headlines for SEARCH crawlers only.
    // Humans still fall straight through with zero DB calls (the hot path is
    // unchanged); only a crawler pays for the one bounded query. ----
    if (path === '/' || path === '/index') {
      const homeUa = request.headers.get('user-agent') || '';
      if (SEARCH_CRAWLER.test(homeUa)) {
        const latest = await getLatestArticles(60);
        if (latest.length) return htmlResponse(buildHomePage(latest));
      }
      return next();
    }

    // ---- 0) Old article URL form /article/view?slug=X → 301 to clean /article/X.
    // Done here (not in vercel.json) so the Location is exact — Vercel would
    // otherwise re-append the original ?slug= query to the destination. Internal
    // rewrites don't re-invoke middleware, so the /article/<slug> shell is safe. ----
    if (path === '/article/view') {
      const s = url.searchParams.get('slug');
      if (s) return redir(`${ORIGIN}/article/${encodeURIComponent(s)}`);
    }

    // ---- 1) The 3 query-param view routes: OG for crawlers, else pass through ----
    if (ROUTES[path]) {
      const slug = url.searchParams.get('slug');
      const ua = request.headers.get('user-agent') || '';
      const isSearch = SEARCH_CRAWLER.test(ua);
      if (slug && (SOCIAL_CRAWLER.test(ua) || isSearch)) {
        // Search engines on an article route get the full prose-rendered page so
        // the body text is indexable without waiting on a JS render pass.
        if (isSearch && path === '/article/view') {
          const full = await getArticleFull(slug);
          if (full) {
            return new Response(buildArticlePage(full, slug), {
              status: 200,
              headers: {
                'content-type': 'text/html; charset=utf-8',
                'cache-control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
              },
            });
          }
        }
        // Search engines on the hub routes get the REAL article list SSR'd
        // (was a bare <h1> = ~1 word of content, i.e. a thin page). This also
        // gives every published article a crawlable internal link.
        if (isSearch && path === '/category/view') {
          const full = await getCategoryFull(slug);
          if (full) return htmlResponse(buildCategoryPage(full.cat, full.articles, slug));
        }
        if (isSearch && path === '/company/view') {
          const full = await getCompanyFull(slug);
          if (full) return htmlResponse(buildCompanyPage(full.co, full.articles, slug));
        }
        // Social crawlers get the head-only page (real title/description/OG, no empty shell).
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

    // ---- 1b) Clean article URLs /article/<slug> — the public form. Humans get
    // the SPA shell via the vercel rewrite; crawlers get server-rendered HTML
    // here (search → full prose page, social → head-only). ----
    const cleanArticle = path.match(/^\/article\/(.+)$/);
    if (cleanArticle && cleanArticle[1] !== 'view') {
      const ua = request.headers.get('user-agent') || '';
      const isSearch = SEARCH_CRAWLER.test(ua);
      if (isSearch || SOCIAL_CRAWLER.test(ua)) {
        const slug = decodeURIComponent(cleanArticle[1].replace(/\/+$/, ''));
        const full = await getArticleFull(slug);
        if (full) {
          const html = isSearch
            ? buildArticlePage(full, slug)
            : (() => {
                const { title, headHtml } = buildHead('/article/view', full, slug);
                return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${headHtml}
</head><body><h1>${esc(title)}</h1></body></html>`;
              })();
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
        return redir(`${ORIGIN}/article/${encodeURIComponent(seg)}`);
      }
      return next(); // unknown single-segment slug → let it 404 (no soft-404, no blind redirect)
    }

    // ---- 4) homepage, static pages, multi-segment unknowns → unchanged ----
    return next();
  } catch {
    return next();
  }
}
