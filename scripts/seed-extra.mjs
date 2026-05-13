#!/usr/bin/env node
/**
 * Top every Karostartup table up to ≥10 rows.
 *
 *  - Creates test auth users (via admin API) → profiles auto-populated by the
 *    handle_new_user trigger; we then update them with role/bio/plus status.
 *  - Promotes the first one to admin, attaches them to seed articles as author.
 *  - Inserts newsletters, newsletter_subscribers, contact_submissions,
 *    funding_rounds, comments, bookmarks.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/seed-extra.mjs
 *
 * Idempotent: skips inserts on tables that already have ≥10 rows; users by
 * email; newsletters by slug; funding-rounds by exact (company,date,lead).
 */

const BASE = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' };

async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path}: ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}
const upsert = (table, rows, onConflict) => rest(`${table}?on_conflict=${onConflict}`, {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rows),
});
const insertOnly = (table, rows) => rest(table, {
  method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(rows),
});
async function count(table) {
  const r = await fetch(`${BASE}/rest/v1/${table}?select=id&limit=1`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const range = r.headers.get('content-range');
  return range ? Number(range.split('/')[1]) : 0;
}

// Auth admin API — create users (skips already-existing)
async function ensureUser(email, password, fullName) {
  // try to find first
  const list = await fetch(`${BASE}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers: H }).then(r => r.json());
  const existing = (list.users || []).find(u => u.email === email);
  if (existing) return existing.id;
  const res = await fetch(`${BASE}/auth/v1/admin/users`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`createUser ${email}: ${res.status} ${JSON.stringify(data)}`);
  return data.id;
}

const daysAgo = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
const dateDaysAgo = (d) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);

(async () => {
  // ====== 1. TEST USERS ======
  console.log('• Creating test auth users…');
  const TEST_PW = 'KaroDemo2026!';
  const userSpecs = [
    { email: 'rohan.editor@karostartup.test',     full_name: 'Rohan Iyer',        role: 'admin',  bio: "Editor-in-chief. Covers fintech and policy. 12 years in business journalism.", twitter_handle: '@rohaniyer',     is_plus_member: true },
    { email: 'priya.author@karostartup.test',     full_name: 'Priya Krishnan',    role: 'editor', bio: "Deputy editor. Founders, deals, and the things VCs won't say on record.",       twitter_handle: '@priyak',        is_plus_member: true },
    { email: 'aman.author@karostartup.test',      full_name: 'Aman Verma',        role: 'author', bio: 'D2C and consumer markets reporter. Previously covered FMCG at Mint.',           twitter_handle: '@amanverma',     is_plus_member: true },
    { email: 'lakshmi.author@karostartup.test',   full_name: 'Lakshmi Narayanan', role: 'author', bio: 'SaaS and B2B software. Bengaluru-based. Former ops at Freshworks.',             twitter_handle: '@lakshmiN',      is_plus_member: false },
    { email: 'devansh.author@karostartup.test',   full_name: 'Devansh Patel',     role: 'author', bio: 'AI infrastructure and Indic-language tech. ML engineer turned reporter.',       twitter_handle: '@devanshp',     is_plus_member: false },
    { email: 'sanya.reader@karostartup.test',     full_name: 'Sanya Mehra',       role: 'reader', bio: 'Operator at a Series B fintech. Plus subscriber since launch.',                  twitter_handle: '@sanyam',        is_plus_member: true },
    { email: 'arjun.reader@karostartup.test',     full_name: 'Arjun Reddy',       role: 'reader', bio: 'GP at an early-stage VC fund. Reads everything.',                                twitter_handle: '@arjunvc',       is_plus_member: true },
    { email: 'naina.reader@karostartup.test',     full_name: 'Naina Bhatia',      role: 'reader', bio: 'Founder, climate tech. Building EV infrastructure in tier-2 cities.',           twitter_handle: '@nainabh',      is_plus_member: false },
    { email: 'vikram.reader@karostartup.test',    full_name: 'Vikram Chauhan',    role: 'reader', bio: 'Public markets investor. Tracks Indian internet companies.',                     twitter_handle: '@vikramc',      is_plus_member: true },
    { email: 'meera.reader@karostartup.test',     full_name: 'Meera Iyengar',     role: 'reader', bio: 'Policy researcher at a Delhi-based think tank.',                                 twitter_handle: '@meerai',       is_plus_member: false },
  ];

  const userIds = {};
  for (const u of userSpecs) {
    const id = await ensureUser(u.email, TEST_PW, u.full_name);
    userIds[u.email] = id;
    process.stdout.write('.');
  }
  console.log(`\n  ${Object.keys(userIds).length} users ready (test password: ${TEST_PW})`);

  // Update profiles (trigger auto-created basic rows; we set role/bio/plus/etc.)
  console.log('• Updating profile rows…');
  await upsert('profiles', userSpecs.map(u => ({
    id: userIds[u.email],
    full_name: u.full_name,
    username: u.email.split('@')[0].replace(/\./g, ''),
    bio: u.bio,
    role: u.role,
    is_plus_member: u.is_plus_member,
    twitter_handle: u.twitter_handle,
  })), 'id');

  const adminId = userIds['rohan.editor@karostartup.test'];
  const authorIds = userSpecs.filter(u => u.role !== 'reader').map(u => userIds[u.email]);
  const readerIds = userSpecs.filter(u => u.role === 'reader').map(u => userIds[u.email]);

  // ====== 2. Backfill article author_id ======
  console.log('• Assigning authors to articles without one…');
  const orphanArticles = await rest('articles?select=id&author_id=is.null');
  if (orphanArticles.length) {
    // Round-robin among non-reader profiles
    for (let i = 0; i < orphanArticles.length; i++) {
      const aid = authorIds[i % authorIds.length];
      await rest(`articles?id=eq.${orphanArticles[i].id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ author_id: aid }),
      });
    }
    console.log(`  assigned authors to ${orphanArticles.length} articles`);
  } else {
    console.log('  none orphan');
  }

  // ====== 3. Newsletters → top up to 10 ======
  if ((await count('newsletters')) < 10) {
    console.log('• Adding newsletters…');
    const newsletters = [
      { slug: 'morning-brief',         name: 'Morning Brief',         description: 'The 6-minute India business read. Every weekday at 8am IST.',     cadence: 'daily',   active: true },
      { slug: 'weekly-funding-brief',  name: 'Weekly Funding Brief',  description: 'Every deal that mattered last week. Mondays at 7am IST.',         cadence: 'weekly',  active: true },
      { slug: 'founder-memo',          name: 'Founder Memo',          description: 'Operator-only insights for people building. Twice a month.',       cadence: 'monthly', active: true },
      { slug: 'ai-india',              name: 'AI India',              description: 'Foundation models, Indic language AI, applied AI in Indian enterprise.', cadence: 'weekly', active: true },
      { slug: 'climate-brief',         name: 'Climate Brief',         description: 'EVs, energy, climate tech, and the green industrial economy.',     cadence: 'weekly',  active: true },
      { slug: 'policy-pulse',          name: 'Policy Pulse',          description: 'RBI, SEBI, the Ministry of Heavy Industries — what the regulator just did.', cadence: 'weekly', active: true },
      { slug: 'd2c-weekly',            name: 'D2C Weekly',            description: 'Consumer brands, quick commerce, and the new Indian retail.',       cadence: 'weekly',  active: true },
      { slug: 'saas-india',            name: 'SaaS India',            description: 'Vertical SaaS, enterprise software, and Indian software exports.',  cadence: 'weekly',  active: true },
      { slug: 'markets-tonight',       name: 'Markets Tonight',       description: 'Public-market closing brief for Indian internet stocks.',           cadence: 'daily',   active: true },
      { slug: 'research-quarterly',    name: 'Research Quarterly',    description: 'Sector deep-dives and proprietary data, four times a year.',         cadence: 'monthly', active: true },
      { slug: 'student-edition',       name: 'Student Edition',       description: 'A free monthly digest curated for college students entering business.', cadence: 'monthly', active: true },
      { slug: 'global-india',          name: 'Global India',          description: 'How Indian capital, talent, and companies move abroad.',             cadence: 'monthly', active: false },
    ];
    await upsert('newsletters', newsletters, 'slug');
  }

  // ====== 4. Newsletter subscribers → 10+ ======
  if ((await count('newsletter_subscribers')) < 10) {
    console.log('• Adding newsletter_subscribers…');
    const nls = await rest('newsletters?select=id,slug');
    const nlMap = Object.fromEntries(nls.map(n => [n.slug, n.id]));
    const samples = [
      ['ankur.shah@loophealth.co.in',  'morning-brief'],
      ['riya.k@stellaris.vc',          'weekly-funding-brief'],
      ['dev.patel@sequence.ai',        'founder-memo'],
      ['neha.rao@vcfund.in',           'morning-brief'],
      ['gaurav@razorpay.com',          'weekly-funding-brief'],
      ['amit@founders.club',           'founder-memo'],
      ['shreya@bgvc.fund',             'ai-india'],
      ['rahul@d2cbrand.co',            'd2c-weekly'],
      ['kavya@policyresearch.in',      'policy-pulse'],
      ['tanvi@climatevc.fund',         'climate-brief'],
      ['priyank@saascompany.com',      'saas-india'],
      ['ishaan@hedgefund.in',          'markets-tonight'],
      ['nikita.j@imperialcollege.ac.uk', 'student-edition'],
      ['operator@unicorn.in',          'morning-brief'],
      ['analyst@bankresearch.in',      'research-quarterly'],
    ];
    const rows = samples
      .filter(([_, slug]) => nlMap[slug])
      .map(([email, slug]) => ({ email, newsletter_id: nlMap[slug] }));
    await upsert('newsletter_subscribers', rows, 'email,newsletter_id');
  }

  // ====== 5. Contact submissions → 10+ ======
  if ((await count('contact_submissions')) < 10) {
    console.log('• Adding contact_submissions…');
    const submissions = [
      { name: 'Harshvardhan Mehta', email: 'harsh@finkart.co.in',     phone: '+91 98765 43210', subject: '[FinKart Technologies] Coverage of our Series C round',     message: 'We just closed our Series C (FinKart Technologies) and would love to brief your team. ₹420Cr at $1.2B valuation, led by Lightspeed. Happy to share the deck and connect founders.', type: 'pr',          status: 'new',         created_at: daysAgo(0.3) },
      { name: 'Anika Reddy',         email: 'anika@karoda.brand',     phone: null,              subject: '[Karoda Foods] D2C millet brand — promotion inquiry',         message: 'We launched a D2C millet snack brand (Karoda Foods) last quarter and are crossing ₹2Cr MRR. Would love to be considered for your D2C coverage. Open to a paid promotion if a feature isn\'t a fit.', type: 'advertise',   status: 'new',         created_at: daysAgo(0.8) },
      { name: 'Vikram Singh',        email: 'vikram@adagency.in',     phone: '+91 90000 11111', subject: '[BluePath Advertising] Brand campaign — Q3 FY26',             message: 'Working with a fintech client looking to run a multi-week brand campaign across your newsletter and home page. Targeting founders + early-stage operators. What does inventory look like? — BluePath Advertising',     type: 'advertise',   status: 'reviewing',   created_at: daysAgo(1.5) },
      { name: 'Anonymous tipster',   email: 'tips@protonmail.com',    phone: null,              subject: 'Layoffs at a unicorn — off the record',                       message: 'I work in HR at a Mumbai-based late-stage startup. They are about to do a 25% RIF next week. Don\'t want to be named but have docs. How do we proceed?',                                          type: 'tip',         status: 'reviewing',   created_at: daysAgo(2)   },
      { name: 'Karan Bhatia',        email: 'karan.b@nira.partners',  phone: '+91 99999 88888', subject: '[Nira Partners] Content partnership',                          message: 'We run a VC fund focused on Indian fintech (Nira Partners). Interested in a quarterly co-published research report on the Indian neobanking landscape. Happy to fund the research.', type: 'partnership', status: 'responded',   created_at: daysAgo(3)   },
      { name: 'Megha Joshi',         email: 'megha@career-co.in',     phone: null,              subject: 'Application — Senior Reporter, Markets',                       message: 'Applying for the senior markets reporter role. 8 years at Bloomberg India. Attaching my CV and three clips. Let me know what works.',                                                                type: 'careers',     status: 'reviewing',   created_at: daysAgo(4)   },
      { name: 'Rohit Talwar',        email: 'rohit@pristyn.health',   phone: '+91 88888 77777', subject: '[Pristyn Care] Funding round announcement',                    message: 'We are announcing our $50M Series E next Tuesday (Pristyn Care). Would like to give your team an exclusive 24-hour window before the broader press release.',                                                       type: 'pr',          status: 'responded',   created_at: daysAgo(5)   },
      { name: 'Sneha Kapoor',        email: 'sneha@studiox.in',       phone: null,              subject: '[Studio X] Speaker request',                                   message: 'Curating an editor panel for our annual conference (Studio X) in October. Bengaluru. Would your editor-in-chief be available?',                                                                                  type: 'partnership', status: 'closed',      created_at: daysAgo(6)   },
      { name: 'Aakash Pillai',       email: 'aakash@cleanenergy.in',  phone: '+91 77777 66666', subject: '[CleanWatt Solar] Promotion: rooftop solar D2C launch',        message: 'Launching India\'s first true D2C rooftop solar brand (CleanWatt Solar). End-to-end via app. Want to discuss a featured story + paid promo. ₹15L budget.',                                                              type: 'advertise',   status: 'new',         created_at: daysAgo(0.5) },
      { name: 'Faisal Kazi',         email: 'faisal@policygroup.org', phone: null,              subject: '[Indus Policy Group] Op-ed submission',                        message: 'I have a 1200-word op-ed on the FAME-III subsidy cut and what it means for Indian EV manufacturing. Pitching for the opinion section.',                                                              type: 'pr',          status: 'new',         created_at: daysAgo(1)   },
      { name: 'Hemant Singh',        email: 'hemant@sme.in',          phone: null,              subject: 'General feedback',                                            message: 'Love the work. One small request — could you add a print-friendly view for long-form articles? Sharing with my non-techie clients is hard right now.',                                                type: 'general',     status: 'responded',   created_at: daysAgo(7)   },
      { name: 'Disha Mehta',         email: 'disha@bschool.edu',      phone: null,              subject: 'Student discount for Plus',                                   message: 'I am a final-year MBA student. Is there a discount on the Plus membership for students? Happy to provide ID.',                                                                                       type: 'general',     status: 'closed',      created_at: daysAgo(10)  },
    ];
    await insertOnly('contact_submissions', submissions);
  }

  // ====== 6. Funding rounds → top to 10+ ======
  if ((await count('funding_rounds')) < 10) {
    console.log('• Adding funding_rounds…');
    const cos = await rest('companies?select=id,slug');
    const coMap = Object.fromEntries(cos.map(c => [c.slug, c.id]));
    const arts = await rest('articles?select=id,slug');
    const artMap = Object.fromEntries(arts.map(a => [a.slug, a.id]));
    const newRounds = [
      { company_slug: 'zoho',    round_type: 'Internal',     amount_usd: 0,           amount_inr: 0,            days: 1095, lead_investor: 'Bootstrapped',      others: [],                                              article_slug: null },
      { company_slug: 'zerodha', round_type: 'Internal',     amount_usd: 0,           amount_inr: 0,            days: 1460, lead_investor: 'Bootstrapped',      others: [],                                              article_slug: 'zerodha-no-equity-fundraise' },
      { company_slug: 'sarvam',  round_type: 'Pre-Seed',     amount_usd: 1_500_000,   amount_inr: 125_000_000,  days: 900,  lead_investor: 'Lightspeed',        others: ['Angel investors'],                              article_slug: null },
      { company_slug: 'cred',    round_type: 'Series F',     amount_usd: 80_000_000,  amount_inr: 6_640_000_000, days: 120, lead_investor: 'Sofina',            others: ['Sequoia', 'Tiger Global'],                       article_slug: 'cred-banking-partnership-bofa' },
      { company_slug: 'razorpay',round_type: 'Series E',     amount_usd: 160_000_000, amount_inr: 13_280_000_000, days: 540, lead_investor: 'GIC',               others: ['Sequoia', 'Ribbit', 'Y Combinator'],            article_slug: null },
      { company_slug: 'zepto',   round_type: 'Series E',     amount_usd: 200_000_000, amount_inr: 16_600_000_000, days: 240, lead_investor: 'Avenir',            others: ['Lightspeed', 'Y Combinator', 'Glade Brook'],    article_slug: null },
      { company_slug: 'razorpay',round_type: 'Debt',         amount_usd: 75_000_000,  amount_inr: 6_225_000_000, days: 180,  lead_investor: 'Silicon Valley Bank', others: ['HSBC'],                                       article_slug: null },
      { company_slug: 'cred',    round_type: 'Series C',     amount_usd: 215_000_000, amount_inr: 17_845_000_000, days: 900, lead_investor: 'Falcon Edge',       others: ['Coatue', 'DST Global'],                          article_slug: null },
      { company_slug: 'zepto',   round_type: 'Series D',     amount_usd: 200_000_000, amount_inr: 16_600_000_000, days: 450, lead_investor: 'Y Combinator',      others: ['Nexus', 'Glade Brook'],                          article_slug: null },
      { company_slug: 'sarvam',  round_type: 'Pre-Series A', amount_usd: 7_000_000,   amount_inr: 580_000_000,  days: 540,  lead_investor: 'Peak XV',           others: ['Lightspeed', 'Khosla'],                          article_slug: null },
    ];
    const rows = newRounds
      .filter(r => coMap[r.company_slug])
      .map(r => ({
        company_id: coMap[r.company_slug],
        round_type: r.round_type,
        amount_usd: r.amount_usd || null,
        amount_inr: r.amount_inr || null,
        announced_date: dateDaysAgo(r.days),
        lead_investor: r.lead_investor,
        other_investors: r.others.length ? r.others : null,
        article_id: r.article_slug ? artMap[r.article_slug] || null : null,
      }));
    await insertOnly('funding_rounds', rows);
  }

  // ====== 7. Comments → 10+ ======
  if ((await count('comments')) < 10) {
    console.log('• Adding comments…');
    const arts = await rest('articles?select=id,slug&status=eq.published&order=published_at.desc&limit=8');
    const allUserIds = [...authorIds, ...readerIds];
    const samples = [
      "This is exactly the kind of journalism Indian business needs. Sharp and specific.",
      "Great piece. One quibble though — the contribution-margin number doesn't quite match what we've seen from peers in the same space.",
      "Strong reporting. Would love to see a follow-up on what the RBI is actually saying behind closed doors.",
      "Operator perspective: the framing here is right but I think the timeline is more aggressive than 24 months.",
      "Bookmarked. Will share with our portfolio companies in the space.",
      "Disagree with the conclusion but the data is excellent.",
      "Finally — someone covering this without the breathless hype. Subscribed to Plus after reading.",
      "We've been tracking similar patterns from the buy-side. Happy to share notes off the record.",
      "Worth noting: the 22% subsidy cut also affects the 4W segment from FY27 onwards. Not mentioned in the piece but relevant.",
      "Bull case is strong. Bear case is that competitor X just raised a similar round and is already operating in the same cities.",
      "Reader from a Series A VC — this matches what we're hearing on the LP side too.",
      "Strong piece. The Tenkasi data point should be the headline, not buried in para 4.",
    ];
    const rows = [];
    for (let i = 0; i < samples.length; i++) {
      const art = arts[i % arts.length];
      const uid = allUserIds[i % allUserIds.length];
      rows.push({
        article_id: art.id,
        user_id: uid,
        content: samples[i],
        is_flagged: i === 5,           // flag one for moderation demo
        is_deleted: false,
        created_at: daysAgo(0.1 + i * 0.4),
      });
    }
    // Add a reply for thread visualization
    if (rows.length >= 2) {
      // Get the inserted parent's id after insert (need return=representation)
      const inserted = await insertOnly('comments', rows);
      const parent = inserted[0];
      await insertOnly('comments', [{
        article_id: parent.article_id,
        user_id: allUserIds[2 % allUserIds.length],
        parent_id: parent.id,
        content: "Replying to the first commenter — strongly agree. The level of specificity here is rare in Indian business press.",
        is_flagged: false,
        is_deleted: false,
        created_at: daysAgo(0.05),
      }]);
    } else {
      await insertOnly('comments', rows);
    }
  }

  // ====== 8. Bookmarks → 10+ ======
  if ((await count('bookmarks')) < 10) {
    console.log('• Adding bookmarks…');
    const arts = await rest('articles?select=id&status=eq.published&order=published_at.desc&limit=10');
    const allUserIds = [...authorIds, ...readerIds];
    const rows = [];
    // Each of the first 5 users bookmarks 2-3 articles
    const plan = [3, 3, 2, 2, 2];
    for (let u = 0; u < plan.length && u < allUserIds.length; u++) {
      for (let i = 0; i < plan[u] && i < arts.length; i++) {
        rows.push({
          user_id: allUserIds[u],
          article_id: arts[(u + i) % arts.length].id,
          created_at: daysAgo(0.3 + u),
        });
      }
    }
    await upsert('bookmarks', rows, 'user_id,article_id');
  }

  // ====== Final counts ======
  console.log('\n✓ Done. Final counts:');
  const tables = ['categories', 'companies', 'articles', 'article_companies', 'funding_rounds', 'market_tickers', 'newsletters', 'newsletter_subscribers', 'contact_submissions', 'comments', 'bookmarks', 'profiles'];
  for (const t of tables) {
    const c = await count(t);
    const mark = c >= 10 ? '✓' : '✗';
    console.log(`  ${mark} ${t.padEnd(24)} ${c}`);
  }
})().catch((e) => { console.error('\n✗ Failed:', e.message); process.exit(1); });
