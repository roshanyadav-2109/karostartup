#!/usr/bin/env node
/**
 * Seed Karostartup via Supabase PostgREST using the service_role key.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/seed-via-rest.mjs
 *
 * Idempotent for categories/companies/articles/article_companies/newsletters
 * (upsert on slug or composite). Funding rounds are inserted only if zero exist
 * for the seeded companies (avoid duplicate inserts on re-run).
 */

const URL_BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var.');
  process.exit(1);
}

async function rest(path, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path}: ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

const upsert = (table, rows, onConflict) =>
  rest(`${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  });

const insertOnly = (table, rows) =>
  rest(table, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  });

const now = Date.now();
const hoursAgo = (h) => new Date(now - h * 3600_000).toISOString();
const daysAgo = (d) => new Date(now - d * 86_400_000).toISOString();
const dateDaysAgo = (d) => new Date(now - d * 86_400_000).toISOString().slice(0, 10);

(async () => {
  // ---------- 1. Categories ----------
  console.log('• Upserting categories…');
  const categories = [
    { slug: 'fintech', name: 'Fintech', description: 'Payments, lending, neobanks, and the rewiring of Indian money.', color: '#d10a11', order_index: 1 },
    { slug: 'saas',    name: 'SaaS',    description: "India's software exporters and the rise of vertical SaaS.",      color: '#0b5394', order_index: 2 },
    { slug: 'd2c',     name: 'D2C',     description: 'Consumer brands building direct relationships at scale.',         color: '#8a3ffc', order_index: 3 },
    { slug: 'ai',      name: 'AI',      description: 'Models, applications, infrastructure, and the India compute story.', color: '#0a7a3b', order_index: 4 },
    { slug: 'climate', name: 'Climate', description: 'Climate tech, EVs, energy, and the green industrial economy.',   color: '#0a7a3b', order_index: 5 },
    { slug: 'policy',  name: 'Policy',  description: 'Regulation, taxation, and the politics of business.',             color: '#c1121f', order_index: 6 },
  ];
  await upsert('categories', categories, 'slug');

  // ---------- 2. Companies ----------
  console.log('• Upserting companies…');
  const companies = [
    { slug: 'razorpay', name: 'Razorpay',
      description: "India's leading payments and business banking platform. Processes a meaningful share of online commerce.",
      sector: 'Fintech', stage: 'late_stage', headquarters_city: 'Bengaluru', headquarters_state: 'Karnataka', founded_year: 2014,
      founders: ['Harshil Mathur', 'Shashank Kumar'], total_funding_usd: 740_000_000, last_valuation_usd: 7_500_000_000,
      employee_count_range: '1001-5000', website_url: 'https://razorpay.com' },
    { slug: 'zerodha', name: 'Zerodha',
      description: "India's largest retail stockbroker. Bootstrapped, profitable, and the most unusual fintech in the country.",
      sector: 'Fintech', stage: 'public', headquarters_city: 'Bengaluru', headquarters_state: 'Karnataka', founded_year: 2010,
      founders: ['Nithin Kamath', 'Nikhil Kamath'], total_funding_usd: 0, last_valuation_usd: 3_000_000_000,
      employee_count_range: '1001-5000', website_url: 'https://zerodha.com' },
    { slug: 'cred', name: 'Cred',
      description: 'Member-only credit card payment app for high-trust consumers. Building a flywheel of premium financial products.',
      sector: 'Fintech', stage: 'series_d_plus', headquarters_city: 'Bengaluru', headquarters_state: 'Karnataka', founded_year: 2018,
      founders: ['Kunal Shah'], total_funding_usd: 800_000_000, last_valuation_usd: 6_400_000_000,
      employee_count_range: '501-1000', website_url: 'https://cred.club' },
    { slug: 'zepto', name: 'Zepto',
      description: '10-minute delivery startup taking on Blinkit and Instamart in the Indian quick-commerce wars.',
      sector: 'D2C', stage: 'series_d_plus', headquarters_city: 'Mumbai', headquarters_state: 'Maharashtra', founded_year: 2021,
      founders: ['Aadit Palicha', 'Kaivalya Vohra'], total_funding_usd: 1_300_000_000, last_valuation_usd: 5_000_000_000,
      employee_count_range: '1001-5000', website_url: 'https://zepto.in' },
    { slug: 'zoho', name: 'Zoho',
      description: 'Chennai-headquartered SaaS major. Profitable, private, and a quiet powerhouse of Indian software.',
      sector: 'SaaS', stage: 'late_stage', headquarters_city: 'Chennai', headquarters_state: 'Tamil Nadu', founded_year: 1996,
      founders: ['Sridhar Vembu', 'Tony Thomas'], total_funding_usd: 0, last_valuation_usd: 5_000_000_000,
      employee_count_range: '5000+', website_url: 'https://zoho.com' },
    { slug: 'sarvam', name: 'Sarvam AI',
      description: 'India-focused foundation model startup. Building voice-first LLMs for Indian languages.',
      sector: 'AI', stage: 'series_a', headquarters_city: 'Bengaluru', headquarters_state: 'Karnataka', founded_year: 2023,
      founders: ['Vivek Raghavan', 'Pratyush Kumar'], total_funding_usd: 41_000_000, last_valuation_usd: 200_000_000,
      employee_count_range: '11-50', website_url: 'https://sarvam.ai' },
  ];
  await upsert('companies', companies, 'slug');

  // ---------- 3. Look up IDs ----------
  console.log('• Reading category / company / admin IDs…');
  const cats = await rest('categories?select=id,slug');
  const catMap = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
  const cos = await rest('companies?select=id,slug');
  const coMap = Object.fromEntries(cos.map((c) => [c.slug, c.id]));
  const admins = await rest('profiles?select=id&role=eq.admin&order=created_at.asc&limit=1');
  const adminId = admins[0]?.id || null;
  console.log(`  admin: ${adminId || '(none — articles will have NULL author_id)'}`);

  // ---------- 4. Articles ----------
  console.log('• Upserting articles…');
  const articles = [
    {
      slug: 'razorpay-banking-license-2026',
      title: 'Razorpay applies for a banking license — and quietly reshapes Indian fintech',
      kicker: 'EXCLUSIVE',
      subtitle: 'The Bengaluru fintech wants to be the operating system for SME finance. The license is just the start.',
      summary: 'Razorpay has filed an application with the RBI for a small finance bank license — a move that could reshape how millions of Indian small businesses access credit, deposits, and treasury services.',
      content: `## A fintech grows up

For ten years Razorpay has been the payments rail for a generation of internet-first Indian businesses. Now it wants to be their bank.

According to three people familiar with the filing, Razorpay submitted an application to the Reserve Bank of India in late April for an SFB (small finance bank) license. The application — which has not been publicly disclosed — is being driven by co-founder Harshil Mathur and a small team of former RBI and bank-regulatory hands the company has hired over the past eighteen months.

> "Payments was always a wedge. Banking is the platform." — A Razorpay executive briefed on the strategy.

### Why now

Three factors drove the decision, according to the people we spoke to: the maturity of Razorpay's SME customer base, the regulatory clarity the RBI has finally provided around new bank licenses, and — most importantly — the realization that PayTM's collapse left a hole in the market for a credible, technology-first SME bank.

### What changes for SMEs

If granted, the license would let Razorpay accept deposits, hold balances on behalf of customers, and offer credit products directly — without depending on partner banks. For India's ~63 million MSMEs, the practical impact would be significant.

### The risks

The RBI process is slow, deeply scrutinous, and historically conservative. A license is not guaranteed and could take 18-24 months even in a favorable scenario. Multiple fintechs have failed at this hurdle before.

But Razorpay's track record — particularly the way the company navigated its 2022 cross-border IPO restructuring — gives it credibility most fintechs lack.`,
      cover_image_url: 'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=1600&q=80',
      cover_caption: "Razorpay's Bengaluru headquarters. Photo: Unsplash",
      category_id: catMap.fintech, author_id: adminId,
      status: 'published', is_featured: true, is_breaking: true, is_premium: false, is_exclusive: true,
      published_at: hoursAgo(2),
      tags: ['razorpay', 'rbi', 'fintech', 'sfb', 'banking'],
    },
    {
      slug: 'zerodha-no-equity-fundraise',
      title: "Zerodha just turned 14 — and still hasn't raised a rupee of equity. Here's why that matters.",
      kicker: 'FOUNDER PROFILE',
      subtitle: "Nithin Kamath's broker has rewritten what an Indian fintech can be — without anyone's permission.",
      summary: "Zerodha celebrated 14 years this month as India's largest stockbroker. It has never raised external capital, never burned for growth, and continues to set the terms of its market. For a generation of operators sick of the venture playbook, that's a quiet revolution.",
      content: `## The unusual case of Zerodha

In a country where every successful fintech is measured by its valuation, Zerodha is the most consequential outlier. The Bengaluru broker — founded in 2010 by Nithin Kamath and his brother Nikhil — has never taken a rupee of equity capital. It is, by some distance, the largest retail stockbroker in India.

> "We never had to take money. We were profitable from year one. Why would we sell what we don't need to sell?" — Nithin Kamath.

The numbers tell a story most VCs would refuse to believe: profitable since 2010, over 70 lakh active clients, run by a team of roughly 1,200, and an annual profit that rivals India's largest old-line brokerages combined.

### What Zerodha proves

Three things, mostly. One: profitability is possible in Indian fintech if you build slowly. Two: the venture growth playbook is not the only path. Three: customer trust, in financial services, compounds harder than capital does.

There are operators across the country quietly studying the Zerodha model — not just for what it built, but for what it didn't.`,
      cover_image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&q=80',
      cover_caption: 'Bengaluru skyline. Photo: Unsplash',
      category_id: catMap.fintech, author_id: adminId,
      status: 'published', is_featured: true, is_breaking: false, is_premium: true, is_exclusive: true,
      published_at: hoursAgo(8),
      tags: ['zerodha', 'nithin-kamath', 'bootstrap', 'fintech'],
    },
    {
      slug: 'zepto-margins-deep-dive',
      title: "Inside Zepto's march to profitability — and the brutal economics of 10-minute delivery",
      kicker: 'DEEP DIVE',
      subtitle: 'Quick commerce is a war of margins. Zepto is winning on revenue but the unit economics still tell a darker story.',
      summary: 'Zepto crossed an annualized revenue run rate of $2B in May 2026 according to internal numbers we have seen. The company\'s public narrative is one of profitability and dominance. The internal one is more nuanced.',
      content: `## The cleanest dataroom in Indian D2C

Zepto, the Mumbai quick-commerce startup co-founded by Aadit Palicha and Kaivalya Vohra, is preparing for an IPO that could happen as early as Q3 2027. To get there, the company has been on an aggressive run of operational tightening, dark-store consolidation, and margin engineering.

### The headline numbers

According to a board document reviewed by Karostartup: gross merchandise value (GMV) for FY26 is tracking to roughly ₹16,500 crore. Net revenue (after offering platform fees and ads) is at approximately ₹4,200 crore. Contribution margin in the top 25 cities is now positive.

### The fine print

But the company's consolidated EBITDA remains in deep red — a number familiar to anyone who has tracked quick commerce globally.

> "The 10-minute promise is a margin tax. Every minute you cut, every dark store you add, eats away at unit economics. We're betting the cohort behavior will save us." — A senior Zepto executive.

### What it means for the IPO

The IPO timing depends almost entirely on whether the company can hit consolidated EBITDA breakeven in at least one quarter before filing. Internal models suggest this is achievable by Q1 2027. External investors are less optimistic.`,
      cover_image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1600&q=80',
      cover_caption: 'Quick commerce delivery. Photo: Unsplash',
      category_id: catMap.d2c, author_id: adminId,
      status: 'published', is_featured: true, is_breaking: false, is_premium: false, is_exclusive: false,
      published_at: daysAgo(1),
      tags: ['zepto', 'quick-commerce', 'ipo', 'd2c'],
    },
    {
      slug: 'sarvam-foundation-model',
      title: 'Sarvam AI says its new model beats GPT-4 on Indic benchmarks. We tested it.',
      kicker: 'ANALYSIS',
      subtitle: "The Bengaluru lab's second-generation foundation model is meaningfully better at Indian languages. The question is whether the market cares.",
      summary: "Sarvam AI's newly released foundation model — internally called S2 — outperforms major Western frontier models on a battery of Indic-language benchmarks. We ran our own tests over a week.",
      content: `## A real Indian frontier lab

Sarvam AI is the closest thing India has to a genuine frontier AI lab. Co-founded by Vivek Raghavan and Pratyush Kumar (both AI4Bharat alums), the Bengaluru-based startup has spent the past 18 months training a series of foundation models specifically tuned for Indian languages and Indian use cases.

### The benchmarks

On standard benchmarks for Hindi, Tamil, Telugu, Bengali, Marathi, and Kannada, Sarvam's S2 model outperforms GPT-4o, Claude Sonnet, and Gemini Pro by margins ranging from 4-12 percentage points depending on the task. The gap is widest in voice tasks and code-switched (Hinglish, Tanglish) inputs.

### Our independent test

We ran S2 against the same benchmarks plus a custom Indian-business-news translation test. Results were broadly consistent with Sarvam's published numbers.

### The market question

The harder question is commercial. Indic-language AI is a genuine technical advance. But India's enterprise AI market is still small, and the average Indian developer defaults to OpenAI and Anthropic.`,
      cover_image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1600&q=80',
      cover_caption: 'Foundation model training. Photo: Unsplash',
      category_id: catMap.ai, author_id: adminId,
      status: 'published', is_featured: false, is_breaking: false, is_premium: false, is_exclusive: false,
      published_at: daysAgo(2),
      tags: ['sarvam', 'ai', 'indic', 'foundation-model'],
    },
    {
      slug: 'zoho-distributed-team-india',
      title: "Why Zoho keeps building offices in tier-3 towns — and what it's taught the rest of Indian tech",
      kicker: 'OPINION',
      subtitle: "Sridhar Vembu's contrarian bet on rural India is starting to look like the most important Indian business decision of the last decade.",
      summary: 'Most Indian software companies cluster their workforces in three cities. Zoho has spent fifteen years doing exactly the opposite. The rest of the industry is finally catching on.',
      content: `## The Tenkasi gamble

When Sridhar Vembu, Zoho's founder, started moving the company's operations to Tenkasi — a small town in southern Tamil Nadu — most of India's tech industry assumed it was an eccentricity. Today the company has roughly forty offices across small towns in Tamil Nadu, Kerala, Andhra Pradesh, and Uttar Pradesh.

### What it taught the industry

That you can hire and retain world-class talent outside the metros. That cost of living matters more to retention than office snacks. That ownership in a small town beats prestige in a big one.

### The follow-on

In 2025 and 2026, at least seven Indian SaaS companies (and one notable fintech) have publicly announced "rural-tier" hiring strategies. None of them are doing it as well as Zoho. But they're all doing it.`,
      cover_image_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80',
      cover_caption: 'Modern office workspace. Photo: Unsplash',
      category_id: catMap.saas, author_id: adminId,
      status: 'published', is_featured: false, is_breaking: false, is_premium: false, is_exclusive: false,
      published_at: daysAgo(3),
      tags: ['zoho', 'rural-tech', 'saas', 'opinion'],
    },
    {
      slug: 'cred-banking-partnership-bofa',
      title: "Cred is in late-stage talks with Bank of America for a co-branded card. Here's the deal",
      kicker: 'BREAKING',
      subtitle: 'The Kunal Shah-led fintech is finalizing a US partnership that could finally crack its NRI strategy.',
      summary: 'Cred is in late-stage talks with Bank of America to launch a co-branded credit card targeted at Indian-origin customers in the United States, according to two people briefed on the discussions.',
      content: `## Cred's US play

The proposed product — a US-issued credit card with Cred-branded UI, rewards tied to India travel, and integration with the Cred app — would mark the first major international expansion attempt for the company since its 2018 launch.

### Why it matters

Cred has long been seen as having one of the strongest premium consumer brands in Indian fintech. Translating that brand to NRI customers in the US would meaningfully widen the company's addressable market — and potentially provide a path to profitability that doesn't depend on Indian credit card growth alone.

### What we know

- The card would be issued by BofA, not Cred
- Cred would handle UX, rewards, and customer acquisition
- Launch is targeted for late 2026 if regulatory approvals come through
- Both companies declined to comment on the record.`,
      cover_image_url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1600&q=80',
      cover_caption: 'Credit cards. Photo: Unsplash',
      category_id: catMap.fintech, author_id: adminId,
      status: 'published', is_featured: false, is_breaking: true, is_premium: false, is_exclusive: false,
      published_at: hoursAgo(5),
      tags: ['cred', 'kunal-shah', 'bofa', 'nri'],
    },
    {
      slug: 'weekly-funding-brief-may-2026',
      title: 'Weekly Funding Brief: $340M raised across 21 deals — and what the slowdown really means',
      kicker: 'WEEKLY ROUNDUP',
      subtitle: 'Three Series Cs, a debt round that mattered, and a Seed deal nobody is talking about.',
      summary: "This week's funding activity was quieter than the last four — but the deals that did happen were more interesting than the volume suggests. Here's our weekly rollup.",
      content: `## Top 5 rounds this week

1. **Sarvam AI** — $41M Series A led by Lightspeed (covered separately).
2. **Pristyn Care** — $50M Series E led by Sequoia.
3. **InCred** — $80M debt facility from a consortium of foreign banks.
4. **Atomberg** — $35M Series C led by Trifecta Capital.
5. **GreyLabs AI** — $22M Series A led by Stellaris and Together Fund.

### What the slowdown means

Indian venture deployment is down ~28% YoY in the May numbers — but if you remove the long tail of $5M-and-below rounds, the high-quality late-stage activity is roughly flat. The compression is happening at the seed and pre-Series-A stage, where founder quality is being scrutinized more aggressively than at any point in the last four years.

### The deal nobody is talking about

A small, unannounced $4M seed round into a Bengaluru company building agentic browser automation for India enterprise. Watch this one.`,
      cover_image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&q=80',
      cover_caption: 'Funding charts. Photo: Unsplash',
      category_id: catMap.fintech, author_id: adminId,
      status: 'published', is_featured: false, is_breaking: false, is_premium: true, is_exclusive: false,
      published_at: hoursAgo(6),
      tags: ['funding', 'weekly', 'seed', 'series-a'],
    },
    {
      slug: 'climate-ev-policy-shift',
      title: 'India quietly cut EV subsidies — and the two-wheeler market is panicking',
      kicker: 'POLICY',
      subtitle: 'The Ministry of Heavy Industries has reduced FAME-III incentives for electric two-wheelers. Ola, Ather, and TVS are scrambling.',
      summary: 'The Ministry of Heavy Industries notified a 22% reduction in FAME-III subsidies for electric two-wheelers effective May 1, 2026. The change was buried in a routine notification — but its market impact is anything but routine.',
      content: `## A policy nobody saw coming

The cut, which took effect at midnight on May 1, reduces the per-vehicle subsidy by roughly ₹5,000-7,000 depending on battery capacity. For a market where retail margins are already razor-thin, the impact is being felt immediately.

### The reaction

Ola Electric's share price fell 6.4% on May 2. Ather Energy's pre-IPO valuation in the grey market dropped roughly 8%. TVS — the most established player and least dependent on subsidies — was the only major to hold steady.

### Why it happened

Three reasons, according to officials we spoke to: the subsidy bill has crossed budget projections, the government wants to push consumers toward Indian-manufactured cells (which most current EV two-wheelers do not use), and there is a quiet political consensus that the EV scheme has subsidized growth that should now stand on its own.`,
      cover_image_url: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=1600&q=80',
      cover_caption: 'Electric two-wheeler charging. Photo: Unsplash',
      category_id: catMap.policy, author_id: adminId,
      status: 'published', is_featured: false, is_breaking: false, is_premium: false, is_exclusive: false,
      published_at: daysAgo(4),
      tags: ['ev', 'fame', 'policy', 'climate'],
    },
  ];
  await upsert('articles', articles, 'slug');

  // ---------- 5. article_companies junction ----------
  console.log('• Linking articles ↔ companies…');
  const arts = await rest('articles?select=id,slug');
  const artMap = Object.fromEntries(arts.map((a) => [a.slug, a.id]));
  const pairs = [
    ['razorpay-banking-license-2026', 'razorpay'],
    ['zerodha-no-equity-fundraise',    'zerodha'],
    ['zepto-margins-deep-dive',         'zepto'],
    ['sarvam-foundation-model',         'sarvam'],
    ['zoho-distributed-team-india',     'zoho'],
    ['cred-banking-partnership-bofa',   'cred'],
  ].filter(([a, c]) => artMap[a] && coMap[c]);
  const junctionRows = pairs.map(([a, c]) => ({ article_id: artMap[a], company_id: coMap[c] }));
  await upsert('article_companies', junctionRows, 'article_id,company_id');

  // ---------- 6. Funding rounds (skip if any already exist) ----------
  console.log('• Checking funding rounds…');
  const existing = await rest('funding_rounds?select=id&limit=1');
  if (existing.length === 0) {
    console.log('  inserting 6 funding rounds…');
    const rounds = [
      { company_id: coMap.sarvam, round_type: 'Series A', amount_usd: 41_000_000, amount_inr: 3_400_000_000,
        announced_date: dateDaysAgo(5), lead_investor: 'Lightspeed',
        other_investors: ['Khosla Ventures', 'Peak XV'],
        article_id: artMap['sarvam-foundation-model'] },
      { company_id: coMap.cred, round_type: 'Series D+', amount_usd: 140_000_000, amount_inr: 11_600_000_000,
        announced_date: dateDaysAgo(30), lead_investor: 'GIC',
        other_investors: ['DST Global', 'Tiger Global'], article_id: null },
      { company_id: coMap.zepto, round_type: 'Series F', amount_usd: 350_000_000, amount_inr: 29_000_000_000,
        announced_date: dateDaysAgo(60), lead_investor: 'Goldman Sachs',
        other_investors: ['Avenir', 'Lightspeed', 'Glade Brook'],
        article_id: artMap['zepto-margins-deep-dive'] },
      { company_id: coMap.razorpay, round_type: 'Series F', amount_usd: 375_000_000, amount_inr: 31_000_000_000,
        announced_date: dateDaysAgo(90), lead_investor: 'Lone Pine Capital',
        other_investors: ['Alkeon', 'TCV', 'Tiger Global', 'Sequoia'],
        article_id: artMap['razorpay-banking-license-2026'] },
      { company_id: coMap.cred, round_type: 'Series E', amount_usd: 251_000_000, amount_inr: 20_000_000_000,
        announced_date: dateDaysAgo(365), lead_investor: 'GIC',
        other_investors: ['Sofina', 'RTP Global', 'Sequoia'], article_id: null },
      { company_id: coMap.sarvam, round_type: 'Seed', amount_usd: 7_000_000, amount_inr: 580_000_000,
        announced_date: dateDaysAgo(730), lead_investor: 'Peak XV',
        other_investors: ['Lightspeed'], article_id: null },
    ];
    await insertOnly('funding_rounds', rounds);
  } else {
    console.log('  funding rounds already present — skipping insert.');
  }

  // ---------- 7. Newsletters ----------
  console.log('• Upserting newsletters…');
  const newsletters = [
    { slug: 'morning-brief',        name: 'Morning Brief',        description: 'The 6-minute India business read. Every weekday at 8am IST.', cadence: 'daily',   active: true },
    { slug: 'weekly-funding-brief', name: 'Weekly Funding Brief', description: 'Every deal that mattered last week. Mondays at 7am IST.',     cadence: 'weekly',  active: true },
    { slug: 'founder-memo',         name: 'Founder Memo',         description: 'Operator-only insights for people building. Twice a month.',  cadence: 'monthly', active: true },
  ];
  await upsert('newsletters', newsletters, 'slug');

  console.log('\n✓ Seed complete.');

  // ---------- Verification ----------
  const counts = await Promise.all([
    rest('categories?select=id', { headers: { Prefer: 'count=exact' } }),
    rest('companies?select=id', { headers: { Prefer: 'count=exact' } }),
    rest('articles?select=id', { headers: { Prefer: 'count=exact' } }),
    rest('article_companies?select=article_id', { headers: { Prefer: 'count=exact' } }),
    rest('funding_rounds?select=id', { headers: { Prefer: 'count=exact' } }),
    rest('newsletters?select=id', { headers: { Prefer: 'count=exact' } }),
  ]);
  console.log(`  categories: ${counts[0].length}`);
  console.log(`  companies:  ${counts[1].length}`);
  console.log(`  articles:   ${counts[2].length}`);
  console.log(`  article_companies: ${counts[3].length}`);
  console.log(`  funding_rounds: ${counts[4].length}`);
  console.log(`  newsletters: ${counts[5].length}`);
})().catch((e) => {
  console.error('\n✗ Seed failed:');
  console.error(e.message);
  process.exit(1);
});
