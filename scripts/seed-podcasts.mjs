#!/usr/bin/env node
/**
 * Seed 6 sample podcast episodes so /podcasts.html isn't empty.
 *
 * Each episode is an articles row with kicker='PODCAST'. The content
 * body opens with a bare YouTube / Spotify URL on its own line — the
 * markdown renderer's media-embed pass turns it into a responsive
 * iframe automatically.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/seed-podcasts.mjs
 *
 * Idempotent (upsert on slug). Re-running updates titles/covers but
 * never duplicates rows.
 */

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

async function rest(path, init = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${path}: ${r.status}\n${t}`);
  return t ? JSON.parse(t) : null;
}

const upsert = (table, rows, onConflict) => rest(`${table}?on_conflict=${onConflict}`, {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rows),
});

const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const daysAgo  = (d) => new Date(Date.now() - d * 86_400_000).toISOString();

(async () => {
  // Find an admin to attach as author (falls back to NULL).
  const admins = await rest('profiles?select=id&role=eq.admin&order=created_at.asc&limit=1');
  const adminId = admins[0]?.id || null;
  // Find a "Founders" or "Opinion" category to attach (fallback to first).
  const cats = await rest('categories?select=id,slug&order=order_index.asc');
  const findCat = (slugs) => slugs.map(s => cats.find(c => c.slug === s)?.id).find(Boolean);
  const catFounders = findCat(['founders', 'opinion', 'startups']) || cats[0]?.id;
  const catFintech  = findCat(['fintech', 'funding']) || cats[0]?.id;
  const catSaas     = findCat(['saas', 'startups']) || cats[0]?.id;
  const catD2c      = findCat(['d2c']) || cats[0]?.id;
  const catAi       = findCat(['ai']) || cats[0]?.id;
  const catPolicy   = findCat(['policy']) || cats[0]?.id;

  const episodes = [
    {
      slug: 'pod-001-kunal-shah-cred',
      title: 'Ep. 01 — Kunal Shah on building Cred from zero',
      subtitle: '60 minutes with the founder on premium consumer brands, why he turned down profitability for three years, and what most fintech founders get wrong about trust.',
      summary: 'Kunal Shah sits down with Karostartup to talk through the original Cred thesis: why a credit card payment app needed to feel like a private club, what changed his mind on monetisation, and the unusual hiring filter the company still uses in 2026.',
      cover: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80',
      embed: 'https://www.youtube.com/watch?v=BHACKCNDMW8',
      category_id: catFintech,
      published_at: hoursAgo(6),
      tags: ['cred', 'kunal-shah', 'fintech', 'podcast'],
    },
    {
      slug: 'pod-002-sridhar-vembu-zoho',
      title: 'Ep. 02 — Sridhar Vembu on rural Indian software',
      subtitle: 'Zoho\'s founder on why he moved operations to Tenkasi, the contrarian bet on small towns, and the case for never raising venture capital.',
      summary: 'A long-form conversation with the most unusual SaaS CEO in India. Recorded at the Zoho campus in Tenkasi over two afternoons.',
      cover: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=1200&q=80',
      embed: 'https://www.youtube.com/watch?v=ZjqLqLqLqLq',
      category_id: catSaas,
      published_at: daysAgo(2),
      tags: ['zoho', 'sridhar-vembu', 'saas', 'bootstrap', 'podcast'],
    },
    {
      slug: 'pod-003-falguni-nayar-nykaa',
      title: 'Ep. 03 — Falguni Nayar on Nykaa\'s next decade',
      subtitle: 'India\'s most successful consumer-tech founder on what changed after the IPO, the fashion bet, and why offline retail still matters.',
      summary: 'Falguni Nayar takes us inside Nykaa\'s playbook: the post-IPO operating model, the fashion expansion, the male-grooming experiment, and the mistakes most D2C brands keep making.',
      cover: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&q=80',
      embed: 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk',
      category_id: catD2c,
      published_at: daysAgo(4),
      tags: ['nykaa', 'falguni-nayar', 'd2c', 'consumer', 'podcast'],
    },
    {
      slug: 'pod-004-harshil-mathur-razorpay',
      title: 'Ep. 04 — Harshil Mathur on Razorpay\'s banking ambition',
      subtitle: 'The Razorpay co-founder on the SFB license filing, building business banking from scratch, and what the PayTM collapse taught India\'s fintech ecosystem.',
      summary: 'Recorded shortly after our exclusive reporting on Razorpay\'s small finance bank application. Harshil Mathur walks through the strategic logic, the regulatory path, and the team he\'s building for the bank.',
      cover: 'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=1200&q=80',
      embed: 'https://open.spotify.com/episode/5h7BCJF8d2RrpFGZmRBOiF',
      category_id: catFintech,
      published_at: daysAgo(7),
      tags: ['razorpay', 'harshil-mathur', 'fintech', 'banking', 'podcast'],
    },
    {
      slug: 'pod-005-vivek-raghavan-sarvam',
      title: 'Ep. 05 — Vivek Raghavan on training an Indian foundation model',
      subtitle: 'Sarvam AI\'s co-founder on why India needs sovereign LLMs, the compute reality check, and what their S2 model gets right.',
      summary: 'A deeply technical conversation about training foundation models for Indian languages — what works, what\'s overhyped, and the policy decisions that will shape Indian AI for a decade.',
      cover: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80',
      embed: 'https://www.youtube.com/watch?v=AOlNF1ujqI4',
      category_id: catAi,
      published_at: daysAgo(10),
      tags: ['sarvam', 'ai', 'llm', 'indic', 'podcast'],
    },
    {
      slug: 'pod-006-nithin-kamath-zerodha',
      title: 'Ep. 06 — Nithin Kamath: 14 years of not raising money',
      subtitle: 'India\'s largest stockbroker on what bootstrapping actually feels like — the temptation to raise, the boring discipline of profitability, and why he won\'t sell.',
      summary: 'The most unusual fintech founder in India sits down for 90 minutes. Bootstrapping, the regulator, retail behaviour, and what comes after.',
      cover: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=1200&q=80',
      embed: 'https://www.youtube.com/watch?v=p3J6an0eS_M',
      category_id: catFintech,
      published_at: daysAgo(14),
      tags: ['zerodha', 'nithin-kamath', 'bootstrap', 'fintech', 'podcast'],
    },
  ];

  // Build content body: embed line + show notes + transcript highlight + about
  const buildContent = (ep, idx) => `${ep.embed}

## What we talked about

- The early years and what almost killed the company
- The bet that paid off (and the one that didn't)
- Hiring philosophy — the unusual filter we use to find the right people
- Why the next 18 months matter more than the last 5 years
- A reading list and three rapid-fire questions

## Pull quote

> "The mistake most founders make is believing the playbook applies to them. India is different, the consumer is different, the regulator is different. Translate the principle, not the tactic."

## About the guest

This episode features a candid, off-the-cuff conversation. Our guest has been kind enough to share details that don't usually make it into press interviews — including specific operating decisions, the moments of doubt, and what they think will look obvious in five years that is invisible today.

## Subscribe

You can subscribe to Karostartup podcasts on Spotify, Apple Podcasts, YouTube, or SoundCloud. New episodes drop every other Tuesday. The full back catalogue lives at [karostartup.com/podcasts](/podcasts.html).
`;

  const rows = episodes.map((ep, i) => ({
    slug: ep.slug,
    title: ep.title,
    kicker: 'PODCAST',
    subtitle: ep.subtitle,
    summary: ep.summary,
    content: buildContent(ep, i),
    cover_image_url: ep.cover,
    cover_caption: 'Photo: Unsplash',
    category_id: ep.category_id,
    author_id: adminId,
    status: 'published',
    is_featured: i === 0,         // first one gets featured flag
    is_breaking: false,
    is_premium: false,
    is_exclusive: i < 2,          // first two are "exclusive"
    published_at: ep.published_at,
    tags: ep.tags,
  }));

  console.log(`Upserting ${rows.length} podcast episodes…`);
  const result = await upsert('articles', rows, 'slug');
  console.log(`✓ ${result.length} episodes ready.\n`);
  for (const r of result) console.log(`  · ${r.slug.padEnd(34)} ${r.title}`);
})().catch((e) => { console.error(e); process.exit(1); });
