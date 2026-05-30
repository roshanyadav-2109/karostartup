#!/usr/bin/env node
/**
 * Generate sitemap.xml at the repo root.
 *
 * Queries Supabase for every published article + every category + every
 * company + every podcast episode, plus the known static pages, and writes
 * an XML sitemap with lastmod / changefreq / priority hints suitable for
 * Google, Bing, and Yandex.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/generate-sitemap.mjs
 *
 * The site origin defaults to https://karostartup.com — override with
 *   SITE_URL=https://your-domain.com node scripts/generate-sitemap.mjs
 *
 * The output sitemap is written to ./sitemap.xml — commit it. A GitHub
 * Action regenerates and re-commits the file on a schedule.
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Canonical host is www. Force apex -> www so the sitemap is always correct
// even if SITE_URL (e.g. the CI fallback) is the bare apex domain.
const SITE = (process.env.SITE_URL || 'https://www.karostartup.com')
  .replace(/\/$/, '')
  .replace(/^https?:\/\/karostartup\.com/i, 'https://www.karostartup.com');
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

async function rest(path) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' }
  });
  if (!r.ok) throw new Error(`GET ${path}: ${r.status}`);
  return r.json();
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry({ loc, lastmod, changefreq, priority, image }) {
  const lines = ['  <url>'];
  lines.push(`    <loc>${xmlEscape(loc)}</loc>`);
  if (lastmod)    lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority != null) lines.push(`    <priority>${priority}</priority>`);
  if (image) {
    lines.push(`    <image:image>`);
    lines.push(`      <image:loc>${xmlEscape(image)}</image:loc>`);
    lines.push(`    </image:image>`);
  }
  lines.push('  </url>');
  return lines.join('\n');
}

function isoDate(d) {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

(async () => {
  console.log(`Generating sitemap for ${SITE}…`);

  // Static pages — pinned set of URLs we know exist
  const staticUrls = [
    { path: '/',                   priority: '1.0', changefreq: 'hourly'  },
    { path: '/best-brands',        priority: '0.8', changefreq: 'daily'   },
    { path: '/newsletters',        priority: '0.6', changefreq: 'weekly'  },
    { path: '/podcasts',           priority: '0.7', changefreq: 'weekly'  },
    { path: '/plus',               priority: '0.5', changefreq: 'monthly' },
    { path: '/share-your-startup', priority: '0.7', changefreq: 'monthly' },
    { path: '/internship',         priority: '0.6', changefreq: 'monthly' },
    { path: '/contact',            priority: '0.4', changefreq: 'monthly' },
    { path: '/privacy',            priority: '0.2', changefreq: 'yearly'  },
    { path: '/terms',              priority: '0.2', changefreq: 'yearly'  },
    { path: '/cookies',            priority: '0.2', changefreq: 'yearly'  },
  ];

  // Dynamic — published articles
  const articles = await rest('articles?select=slug,published_at,updated_at,cover_image_url,is_breaking,source,approved_for_public&status=eq.published&order=published_at.desc&limit=10000');

  // Respect the auto-fetch public-visibility toggle: hidden PIB (auto-fetched)
  // articles must not appear in the sitemap, or Google indexes pages the public
  // site renders as "Story not found" (soft-404s). Mirror the DB RLS logic and
  // fail closed (treat as hidden) if the setting row is missing.
  let autoFetchVisible = false;
  try {
    const s = await rest('site_settings?select=value&key=eq.auto_fetch');
    autoFetchVisible = s?.[0]?.value?.public_visible === true;
  } catch { autoFetchVisible = false; }
  const articleVisible = (a) => a.source !== 'pib' || a.approved_for_public === true || autoFetchVisible;
  const visibleArticles = articles.filter(articleVisible);
  console.log(`  ${articles.length} published articles (${articles.length - visibleArticles.length} auto-fetched hidden from sitemap)`);

  // Dynamic — categories
  const categories = await rest('categories?select=slug,name&order=order_index.asc');
  console.log(`  ${categories.length} categories`);

  // Dynamic — companies
  const companies = await rest('companies?select=slug,updated_at&order=name.asc');
  console.log(`  ${companies.length} companies`);

  const today = new Date().toISOString().slice(0, 10);

  const entries = [];

  for (const s of staticUrls) {
    entries.push(urlEntry({
      loc: `${SITE}${s.path}`,
      lastmod: today,
      changefreq: s.changefreq,
      priority: s.priority,
    }));
  }

  for (const a of visibleArticles) {
    entries.push(urlEntry({
      loc: `${SITE}/${encodeURIComponent(a.slug)}`,
      lastmod: isoDate(a.updated_at || a.published_at) || today,
      // Breaking news changes often; archive articles stabilise after a week
      changefreq: a.is_breaking ? 'hourly' : (Date.now() - new Date(a.published_at).getTime() < 7 * 86400000 ? 'daily' : 'monthly'),
      priority: '0.7',
      image: a.cover_image_url || null,
    }));
  }

  for (const c of categories) {
    entries.push(urlEntry({
      loc: `${SITE}/category/${encodeURIComponent(c.slug)}`,
      lastmod: today,
      changefreq: 'daily',
      priority: '0.6',
    }));
  }

  for (const co of companies) {
    entries.push(urlEntry({
      loc: `${SITE}/company/${encodeURIComponent(co.slug)}`,
      lastmod: isoDate(co.updated_at) || today,
      changefreq: 'weekly',
      priority: '0.5',
    }));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/0.9">
${entries.join('\n')}
</urlset>
`;

  const out = resolve(__dirname, '..', 'sitemap.xml');
  writeFileSync(out, xml);
  console.log(`\n✓ Wrote ${out}`);
  console.log(`  Total URLs: ${entries.length}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
