-- ============================================================
-- KAROSTARTUP — Sample seed data
-- ============================================================
-- Run this in the Supabase SQL editor AFTER you've signed up
-- your first user and promoted them to admin via:
--
--   UPDATE profiles SET role='admin' WHERE id = (SELECT id FROM auth.users WHERE email='YOUR_EMAIL');
--
-- This file is idempotent — re-running it will not duplicate
-- rows (uses ON CONFLICT). Cover images come from Unsplash CDN.
-- ============================================================

-- ---------- Categories ----------
INSERT INTO categories (slug, name, description, color, order_index) VALUES
  ('fintech',  'Fintech',  'Payments, lending, neobanks, and the rewiring of Indian money.',          '#d10a11', 1),
  ('saas',     'SaaS',     'India''s software exporters and the rise of vertical SaaS.',              '#0b5394', 2),
  ('d2c',      'D2C',      'Consumer brands building direct relationships at scale.',                 '#8a3ffc', 3),
  ('ai',       'AI',       'Models, applications, infrastructure, and the India compute story.',      '#0a7a3b', 4),
  ('climate',  'Climate',  'Climate tech, EVs, energy, and the green industrial economy.',            '#0a7a3b', 5),
  ('policy',   'Policy',   'Regulation, taxation, and the politics of business.',                     '#c1121f', 6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color, order_index = EXCLUDED.order_index;

-- ---------- Companies ----------
INSERT INTO companies (slug, name, description, sector, stage, headquarters_city, headquarters_state, founded_year, founders, total_funding_usd, last_valuation_usd, employee_count_range, website_url) VALUES
  ('razorpay', 'Razorpay',
   'India''s leading payments and business banking platform. Processes a meaningful share of online commerce.',
   'Fintech', 'late_stage', 'Bengaluru', 'Karnataka', 2014,
   ARRAY['Harshil Mathur', 'Shashank Kumar'], 740000000, 7500000000, '1001-5000', 'https://razorpay.com'),

  ('zerodha', 'Zerodha',
   'India''s largest retail stockbroker. Bootstrapped, profitable, and the most unusual fintech in the country.',
   'Fintech', 'public', 'Bengaluru', 'Karnataka', 2010,
   ARRAY['Nithin Kamath', 'Nikhil Kamath'], 0, 3000000000, '1001-5000', 'https://zerodha.com'),

  ('cred', 'Cred',
   'Member-only credit card payment app for high-trust consumers. Building a flywheel of premium financial products.',
   'Fintech', 'series_d_plus', 'Bengaluru', 'Karnataka', 2018,
   ARRAY['Kunal Shah'], 800000000, 6400000000, '501-1000', 'https://cred.club'),

  ('zepto', 'Zepto',
   '10-minute delivery startup taking on Blinkit and Instamart in the Indian quick-commerce wars.',
   'D2C', 'series_d_plus', 'Mumbai', 'Maharashtra', 2021,
   ARRAY['Aadit Palicha', 'Kaivalya Vohra'], 1300000000, 5000000000, '1001-5000', 'https://zepto.in'),

  ('zoho', 'Zoho',
   'Chennai-headquartered SaaS major. Profitable, private, and a quiet powerhouse of Indian software.',
   'SaaS', 'late_stage', 'Chennai', 'Tamil Nadu', 1996,
   ARRAY['Sridhar Vembu', 'Tony Thomas'], 0, 5000000000, '5000+', 'https://zoho.com'),

  ('sarvam', 'Sarvam AI',
   'India-focused foundation model startup. Building voice-first LLMs for Indian languages.',
   'AI', 'series_a', 'Bengaluru', 'Karnataka', 2023,
   ARRAY['Vivek Raghavan', 'Pratyush Kumar'], 41000000, 200000000, '11-50', 'https://sarvam.ai')
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description, sector = EXCLUDED.sector, stage = EXCLUDED.stage,
  total_funding_usd = EXCLUDED.total_funding_usd, last_valuation_usd = EXCLUDED.last_valuation_usd;

-- ---------- Articles ----------
-- Cover images served from Unsplash CDN (stable, no auth required).
-- author_id resolves to the first admin if one exists, NULL otherwise.

INSERT INTO articles (slug, title, kicker, subtitle, summary, content, cover_image_url, cover_caption,
                     category_id, author_id, status, is_featured, is_breaking, is_premium, is_exclusive,
                     published_at, tags)
VALUES
  ('razorpay-banking-license-2026',
   'Razorpay applies for a banking license — and quietly reshapes Indian fintech',
   'EXCLUSIVE',
   'The Bengaluru fintech wants to be the operating system for SME finance. The license is just the start.',
   'Razorpay has filed an application with the RBI for a small finance bank license — a move that could reshape how millions of Indian small businesses access credit, deposits, and treasury services.',
   '## A fintech grows up

For ten years Razorpay has been the payments rail for a generation of internet-first Indian businesses. Now it wants to be their bank.

According to three people familiar with the filing, Razorpay submitted an application to the Reserve Bank of India in late April for an SFB (small finance bank) license. The application — which has not been publicly disclosed — is being driven by co-founder Harshil Mathur and a small team of former RBI and bank-regulatory hands the company has hired over the past eighteen months.

> "Payments was always a wedge. Banking is the platform." — A Razorpay executive briefed on the strategy.

### Why now

Three factors drove the decision, according to the people we spoke to: the maturity of Razorpay''s SME customer base, the regulatory clarity the RBI has finally provided around new bank licenses, and — most importantly — the realization that PayTM''s collapse left a hole in the market for a credible, technology-first SME bank.

### What changes for SMEs

If granted, the license would let Razorpay accept deposits, hold balances on behalf of customers, and offer credit products directly — without depending on partner banks. For India''s ~63 million MSMEs, the practical impact would be significant.

### The risks

The RBI process is slow, deeply scrutinous, and historically conservative. A license is not guaranteed and could take 18-24 months even in a favorable scenario. Multiple fintechs have failed at this hurdle before.

But Razorpay''s track record — particularly the way the company navigated its 2022 cross-border IPO restructuring — gives it credibility most fintechs lack.',
   'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=1600&q=80',
   'Razorpay''s Bengaluru headquarters. Photo: Unsplash',
   (SELECT id FROM categories WHERE slug = 'fintech'),
   (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
   'published', true, true, false, true, NOW() - INTERVAL '2 hours',
   ARRAY['razorpay','rbi','fintech','sfb','banking']),

  ('zerodha-no-equity-fundraise',
   'Zerodha just turned 14 — and still hasn''t raised a rupee of equity. Here''s why that matters.',
   'FOUNDER PROFILE',
   'Nithin Kamath''s broker has rewritten what an Indian fintech can be — without anyone''s permission.',
   'Zerodha celebrated 14 years this month as India''s largest stockbroker. It has never raised external capital, never burned for growth, and continues to set the terms of its market. For a generation of operators sick of the venture playbook, that''s a quiet revolution.',
   '## The unusual case of Zerodha

In a country where every successful fintech is measured by its valuation, Zerodha is the most consequential outlier. The Bengaluru broker — founded in 2010 by Nithin Kamath and his brother Nikhil — has never taken a rupee of equity capital. It is, by some distance, the largest retail stockbroker in India.

> "We never had to take money. We were profitable from year one. Why would we sell what we don''t need to sell?" — Nithin Kamath.

The numbers tell a story most VCs would refuse to believe: profitable since 2010, over 70 lakh active clients, run by a team of roughly 1,200, and an annual profit that rivals India''s largest old-line brokerages combined.

### What Zerodha proves

Three things, mostly. One: profitability is possible in Indian fintech if you build slowly. Two: the venture growth playbook is not the only path. Three: customer trust, in financial services, compounds harder than capital does.

There are operators across the country quietly studying the Zerodha model — not just for what it built, but for what it didn''t.',
   'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&q=80',
   'Bengaluru skyline. Photo: Unsplash',
   (SELECT id FROM categories WHERE slug = 'fintech'),
   (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
   'published', true, false, true, true, NOW() - INTERVAL '8 hours',
   ARRAY['zerodha','nithin-kamath','bootstrap','fintech']),

  ('zepto-margins-deep-dive',
   'Inside Zepto''s march to profitability — and the brutal economics of 10-minute delivery',
   'DEEP DIVE',
   'Quick commerce is a war of margins. Zepto is winning on revenue but the unit economics still tell a darker story.',
   'Zepto crossed an annualized revenue run rate of $2B in May 2026 according to internal numbers we have seen. The company''s public narrative is one of profitability and dominance. The internal one is more nuanced.',
   '## The cleanest dataroom in Indian D2C

Zepto, the Mumbai quick-commerce startup co-founded by Aadit Palicha and Kaivalya Vohra, is preparing for an IPO that could happen as early as Q3 2027. To get there, the company has been on an aggressive run of operational tightening, dark-store consolidation, and margin engineering.

### The headline numbers

According to a board document reviewed by Karostartup: gross merchandise value (GMV) for FY26 is tracking to roughly ₹16,500 crore. Net revenue (after offering platform fees and ads) is at approximately ₹4,200 crore. Contribution margin in the top 25 cities is now positive.

### The fine print

But the company''s consolidated EBITDA remains in deep red — a number familiar to anyone who has tracked quick commerce globally.

> "The 10-minute promise is a margin tax. Every minute you cut, every dark store you add, eats away at unit economics. We''re betting the cohort behavior will save us." — A senior Zepto executive.

### What it means for the IPO

The IPO timing depends almost entirely on whether the company can hit consolidated EBITDA breakeven in at least one quarter before filing. Internal models suggest this is achievable by Q1 2027. External investors are less optimistic.',
   'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1600&q=80',
   'Quick commerce delivery. Photo: Unsplash',
   (SELECT id FROM categories WHERE slug = 'd2c'),
   (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
   'published', true, false, false, false, NOW() - INTERVAL '1 day',
   ARRAY['zepto','quick-commerce','ipo','d2c']),

  ('sarvam-foundation-model',
   'Sarvam AI says its new model beats GPT-4 on Indic benchmarks. We tested it.',
   'ANALYSIS',
   'The Bengaluru lab''s second-generation foundation model is meaningfully better at Indian languages. The question is whether the market cares.',
   'Sarvam AI''s newly released foundation model — internally called S2 — outperforms major Western frontier models on a battery of Indic-language benchmarks. We ran our own tests over a week.',
   '## A real Indian frontier lab

Sarvam AI is the closest thing India has to a genuine frontier AI lab. Co-founded by Vivek Raghavan and Pratyush Kumar (both AI4Bharat alums), the Bengaluru-based startup has spent the past 18 months training a series of foundation models specifically tuned for Indian languages and Indian use cases.

### The benchmarks

On standard benchmarks for Hindi, Tamil, Telugu, Bengali, Marathi, and Kannada, Sarvam''s S2 model outperforms GPT-4o, Claude Sonnet, and Gemini Pro by margins ranging from 4-12 percentage points depending on the task. The gap is widest in voice tasks and code-switched (Hinglish, Tanglish) inputs.

### Our independent test

We ran S2 against the same benchmarks plus a custom Indian-business-news translation test. Results were broadly consistent with Sarvam''s published numbers.

### The market question

The harder question is commercial. Indic-language AI is a genuine technical advance. But India''s enterprise AI market is still small, and the average Indian developer defaults to OpenAI and Anthropic.',
   'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1600&q=80',
   'Foundation model training. Photo: Unsplash',
   (SELECT id FROM categories WHERE slug = 'ai'),
   (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
   'published', false, false, false, false, NOW() - INTERVAL '2 days',
   ARRAY['sarvam','ai','indic','foundation-model']),

  ('zoho-distributed-team-india',
   'Why Zoho keeps building offices in tier-3 towns — and what it''s taught the rest of Indian tech',
   'OPINION',
   'Sridhar Vembu''s contrarian bet on rural India is starting to look like the most important Indian business decision of the last decade.',
   'Most Indian software companies cluster their workforces in three cities. Zoho has spent fifteen years doing exactly the opposite. The rest of the industry is finally catching on.',
   '## The Tenkasi gamble

When Sridhar Vembu, Zoho''s founder, started moving the company''s operations to Tenkasi — a small town in southern Tamil Nadu — most of India''s tech industry assumed it was an eccentricity. Today the company has roughly forty offices across small towns in Tamil Nadu, Kerala, Andhra Pradesh, and Uttar Pradesh.

### What it taught the industry

That you can hire and retain world-class talent outside the metros. That cost of living matters more to retention than office snacks. That ownership in a small town beats prestige in a big one.

### The follow-on

In 2025 and 2026, at least seven Indian SaaS companies (and one notable fintech) have publicly announced "rural-tier" hiring strategies. None of them are doing it as well as Zoho. But they''re all doing it.',
   'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80',
   'Modern office workspace. Photo: Unsplash',
   (SELECT id FROM categories WHERE slug = 'saas'),
   (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
   'published', false, false, false, false, NOW() - INTERVAL '3 days',
   ARRAY['zoho','rural-tech','saas','opinion']),

  ('cred-banking-partnership-bofa',
   'Cred is in late-stage talks with Bank of America for a co-branded card. Here''s the deal',
   'BREAKING',
   'The Kunal Shah-led fintech is finalizing a US partnership that could finally crack its NRI strategy.',
   'Cred is in late-stage talks with Bank of America to launch a co-branded credit card targeted at Indian-origin customers in the United States, according to two people briefed on the discussions.',
   '## Cred''s US play

The proposed product — a US-issued credit card with Cred-branded UI, rewards tied to India travel, and integration with the Cred app — would mark the first major international expansion attempt for the company since its 2018 launch.

### Why it matters

Cred has long been seen as having one of the strongest premium consumer brands in Indian fintech. Translating that brand to NRI customers in the US would meaningfully widen the company''s addressable market — and potentially provide a path to profitability that doesn''t depend on Indian credit card growth alone.

### What we know

- The card would be issued by BofA, not Cred
- Cred would handle UX, rewards, and customer acquisition
- Launch is targeted for late 2026 if regulatory approvals come through
- Both companies declined to comment on the record.',
   'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1600&q=80',
   'Credit cards. Photo: Unsplash',
   (SELECT id FROM categories WHERE slug = 'fintech'),
   (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
   'published', false, true, false, false, NOW() - INTERVAL '5 hours',
   ARRAY['cred','kunal-shah','bofa','nri']),

  ('weekly-funding-brief-may-2026',
   'Weekly Funding Brief: $340M raised across 21 deals — and what the slowdown really means',
   'WEEKLY ROUNDUP',
   'Three Series Cs, a debt round that mattered, and a Seed deal nobody is talking about.',
   'This week''s funding activity was quieter than the last four — but the deals that did happen were more interesting than the volume suggests. Here''s our weekly rollup.',
   '## Top 5 rounds this week

1. **Sarvam AI** — $41M Series A led by Lightspeed (covered separately).
2. **Pristyn Care** — $50M Series E led by Sequoia.
3. **InCred** — $80M debt facility from a consortium of foreign banks.
4. **Atomberg** — $35M Series C led by Trifecta Capital.
5. **GreyLabs AI** — $22M Series A led by Stellaris and Together Fund.

### What the slowdown means

Indian venture deployment is down ~28% YoY in the May numbers — but if you remove the long tail of $5M-and-below rounds, the high-quality late-stage activity is roughly flat. The compression is happening at the seed and pre-Series-A stage, where founder quality is being scrutinized more aggressively than at any point in the last four years.

### The deal nobody is talking about

A small, unannounced $4M seed round into a Bengaluru company building agentic browser automation for India enterprise. Watch this one.',
   'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&q=80',
   'Funding charts. Photo: Unsplash',
   (SELECT id FROM categories WHERE slug = 'fintech'),
   (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
   'published', false, false, true, false, NOW() - INTERVAL '6 hours',
   ARRAY['funding','weekly','seed','series-a']),

  ('climate-ev-policy-shift',
   'India quietly cut EV subsidies — and the two-wheeler market is panicking',
   'POLICY',
   'The Ministry of Heavy Industries has reduced FAME-III incentives for electric two-wheelers. Ola, Ather, and TVS are scrambling.',
   'The Ministry of Heavy Industries notified a 22% reduction in FAME-III subsidies for electric two-wheelers effective May 1, 2026. The change was buried in a routine notification — but its market impact is anything but routine.',
   '## A policy nobody saw coming

The cut, which took effect at midnight on May 1, reduces the per-vehicle subsidy by roughly ₹5,000-7,000 depending on battery capacity. For a market where retail margins are already razor-thin, the impact is being felt immediately.

### The reaction

Ola Electric''s share price fell 6.4% on May 2. Ather Energy''s pre-IPO valuation in the grey market dropped roughly 8%. TVS — the most established player and least dependent on subsidies — was the only major to hold steady.

### Why it happened

Three reasons, according to officials we spoke to: the subsidy bill has crossed budget projections, the government wants to push consumers toward Indian-manufactured cells (which most current EV two-wheelers do not use), and there is a quiet political consensus that the EV scheme has subsidized growth that should now stand on its own.',
   'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=1600&q=80',
   'Electric two-wheeler charging. Photo: Unsplash',
   (SELECT id FROM categories WHERE slug = 'policy'),
   (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1),
   'published', false, false, false, false, NOW() - INTERVAL '4 days',
   ARRAY['ev','fame','policy','climate'])
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, kicker = EXCLUDED.kicker, subtitle = EXCLUDED.subtitle,
  summary = EXCLUDED.summary, content = EXCLUDED.content, cover_image_url = EXCLUDED.cover_image_url,
  status = EXCLUDED.status, is_featured = EXCLUDED.is_featured, is_breaking = EXCLUDED.is_breaking,
  is_premium = EXCLUDED.is_premium, is_exclusive = EXCLUDED.is_exclusive, published_at = EXCLUDED.published_at;

-- ---------- Article → Company junction ----------
INSERT INTO article_companies (article_id, company_id)
SELECT a.id, c.id FROM articles a, companies c
WHERE (a.slug = 'razorpay-banking-license-2026' AND c.slug = 'razorpay')
   OR (a.slug = 'zerodha-no-equity-fundraise' AND c.slug = 'zerodha')
   OR (a.slug = 'zepto-margins-deep-dive' AND c.slug = 'zepto')
   OR (a.slug = 'sarvam-foundation-model' AND c.slug = 'sarvam')
   OR (a.slug = 'zoho-distributed-team-india' AND c.slug = 'zoho')
   OR (a.slug = 'cred-banking-partnership-bofa' AND c.slug = 'cred')
ON CONFLICT (article_id, company_id) DO NOTHING;

-- ---------- Funding rounds ----------
INSERT INTO funding_rounds (company_id, round_type, amount_usd, amount_inr, announced_date, lead_investor, other_investors, article_id) VALUES
  ((SELECT id FROM companies WHERE slug='sarvam'), 'Series A', 41000000, 3400000000, CURRENT_DATE - 5,
   'Lightspeed', ARRAY['Khosla Ventures', 'Peak XV'],
   (SELECT id FROM articles WHERE slug='sarvam-foundation-model')),

  ((SELECT id FROM companies WHERE slug='cred'), 'Series D+', 140000000, 11600000000, CURRENT_DATE - 30,
   'GIC', ARRAY['DST Global', 'Tiger Global'], NULL),

  ((SELECT id FROM companies WHERE slug='zepto'), 'Series F', 350000000, 29000000000, CURRENT_DATE - 60,
   'Goldman Sachs', ARRAY['Avenir', 'Lightspeed', 'Glade Brook'],
   (SELECT id FROM articles WHERE slug='zepto-margins-deep-dive')),

  ((SELECT id FROM companies WHERE slug='razorpay'), 'Series F', 375000000, 31000000000, CURRENT_DATE - 90,
   'Lone Pine Capital', ARRAY['Alkeon', 'TCV', 'Tiger Global', 'Sequoia'],
   (SELECT id FROM articles WHERE slug='razorpay-banking-license-2026')),

  ((SELECT id FROM companies WHERE slug='cred'), 'Series E', 251000000, 20000000000, CURRENT_DATE - 365,
   'GIC', ARRAY['Sofina', 'RTP Global', 'Sequoia'], NULL),

  ((SELECT id FROM companies WHERE slug='sarvam'), 'Seed', 7000000, 580000000, CURRENT_DATE - 730,
   'Peak XV', ARRAY['Lightspeed'], NULL)
ON CONFLICT DO NOTHING;

-- ---------- Newsletters ----------
INSERT INTO newsletters (slug, name, description, cadence, active) VALUES
  ('morning-brief',         'Morning Brief',          'The 6-minute India business read. Every weekday at 8am IST.', 'daily',   true),
  ('weekly-funding-brief',  'Weekly Funding Brief',   'Every deal that mattered last week. Mondays at 7am IST.',     'weekly',  true),
  ('founder-memo',          'Founder Memo',           'Operator-only insights for people building. Twice a month.',  'monthly', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, cadence = EXCLUDED.cadence, active = EXCLUDED.active;

-- ============================================================
-- Done. Refresh the homepage and you should see:
--   - Hero with featured stories + cover images
--   - Top strip, sector pulse, long reads, founder spotlight all populated
--   - Funding tracker table with 6 rounds
--   - 3 newsletters on /newsletters.html
-- ============================================================
