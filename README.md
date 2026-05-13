# Karostartup

> India's business of business. A static HTML/CSS/JS news site competing with YourStory, Inc42, ET Startups, and Moneycontrol. FT meets Inc42 — sharp, founder-first, data-driven editorial.

No build step. No bundler. No framework. Every page is plain HTML that talks directly to Supabase from the browser via the official JS SDK on CDN.

---

## Stack

- **Frontend:** Plain HTML + CSS + vanilla JS
- **Backend:** Supabase (Postgres + Auth + RLS + RPC)
- **Fonts:** Fraunces (display), Inter Tight (UI), JetBrains Mono (data) — Google Fonts
- **Hosting:** Anywhere static. Vercel/Netlify/Cloudflare Pages all work.

The anon Supabase key is hardcoded in `/assets/app.js`. **RLS protects everything** — the key is safe to expose.

---

## Folder structure

```
/
  index.html                   ← homepage
  contact.html                 ← public contact form (?type=promotion/advertise/tip/pr/partnership/careers/general)
  about.html
  plus.html
  newsletters.html
  search.html                  ← ?q=
  profile.html                 ← signed-in user profile
  /article/view.html           ← reads ?slug=
  /category/view.html          ← reads ?slug=
  /company/view.html           ← reads ?slug=
  /auth/signin.html
  /auth/signup.html
  /admin/
    index.html                 ← dashboard
    shell.js                   ← shared admin sidebar
    articles.html              ← article list + bulk actions
    article-edit.html          ← editor (reads ?id= or no id for new)
    companies.html
    company-edit.html
    funding.html               ← funding rounds inline form + table
    tickers.html               ← market ticker manager
    comments.html              ← moderation
    users.html                 ← role + Plus management (admin only)
    submissions.html           ← contact inbox (two-pane)
    newsletters.html           ← admin only
  /assets/style.css            ← single design system file
  /assets/app.js               ← Supabase client + helpers + layout renderers
  vercel.json
  .gitignore
  README.md
```

---

## Local development

You need a way to serve static files. Easiest:

```bash
# from inside the project root
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

Other options that work fine:

```bash
npx serve .
# or
php -S localhost:8000
```

> Don't open the HTML files directly with `file://` — the Supabase SDK and font imports need a real HTTP origin.

---

## Supabase setup

The Supabase project is already provisioned at `https://svwpvqmqmisoffbnnjdc.supabase.co`. The anon key is wired into `/assets/app.js`.

If you ever need to recreate it elsewhere, the schema includes:

- `profiles` — extends `auth.users`, with `role` enum (reader/author/editor/admin) and `is_plus_member` bool
- `categories`, `companies`, `articles`
- `article_companies` (junction)
- `funding_rounds`, `market_tickers`
- `newsletters`, `newsletter_subscribers`
- `comments`, `bookmarks`
- `contact_submissions` (the contact-form inbox)

RPC functions in use:
- `increment_article_views(article_uuid uuid)` — fired on every article page load
- `is_staff()`, `is_editor_or_admin()`, `is_admin()` — server-side role checks (also mirrored client-side)

---

## First admin / making yourself staff

After signing up your first user via `/auth/signup.html`, open the Supabase SQL editor and run:

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE');
```

Then sign in and go to `/admin/` — you should see the dashboard. From `/admin/users.html` you can promote other users to author/editor/admin.

### Loading sample data (recommended)

After promoting yourself to admin, open `seed.sql` from this repo and paste it into the Supabase SQL editor. It inserts:

- 6 categories (Fintech, SaaS, D2C, AI, Climate, Policy)
- 6 companies (Razorpay, Zerodha, Cred, Zepto, Zoho, Sarvam AI)
- 8 articles with cover images from the Unsplash CDN — 3 featured, 2 breaking, 1 founder profile, 1 premium, 1 exclusive — so the homepage hero, top strip, sector pulse, long reads, and founder spotlight all populate
- 6 funding rounds linked to companies + articles
- 6 market tickers (Nifty 50, Sensex, Bank Nifty, Nifty IT, INR/USD, Gold)
- 3 newsletters

The script is idempotent — re-running it updates existing rows rather than duplicating. Articles are authored by your admin profile if one exists.

Role meanings:
- `reader` — default for new signups. Can comment, bookmark, subscribe to newsletters.
- `author` — can be assigned as article author. Cannot access admin yet (depends on your RLS policies).
- `editor` — can publish/edit articles, manage companies, funding, tickers, comments, submissions.
- `admin` — everything, plus user management and newsletter setup.

`requireStaff()` (client-side check in admin pages) allows `author`/`editor`/`admin`. RLS policies on your tables decide what actually persists.

---

## Live market tickers

The strip at the top of every page (Nifty/Sensex/S&P/FTSE/DAX/OMX/Nikkei/HSI + FX + gold + crude) is backed by a script that pulls live data from Yahoo Finance's free unauthenticated `query1.finance.yahoo.com/v8/finance/chart/...` endpoint and upserts into the `market_tickers` table.

**Symbols covered** (18): NIFTY 50, SENSEX, Bank Nifty, S&P 500, Nasdaq Comp., Dow Jones, FTSE 100, DAX, CAC 40, OMX Stockholm 30, Nikkei 225, Hang Seng, USD/INR, EUR/USD, GBP/USD, USD/SEK, Gold, WTI Crude. Tuned for an audience spanning India, US, UK, EU (esp. Sweden), and Asia.

**Frontend behaviour:** the ticker auto-refreshes from the DB every 60s without a page reload. The CSS scroll animation isn't interrupted because we patch the value spans in place rather than re-rendering the animated container.

### Running the fetcher

```bash
SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/update-tickers.mjs
```

Outputs an aligned table of all 18 symbols with their latest values + percent change.

### Scheduling (pick one)

**Option A — GitHub Actions (recommended, free, zero ops):**

A workflow at `.github/workflows/update-tickers.yml` runs every 5 minutes. To enable it:

1. Push the repo to GitHub (already done at `roshanyadav-2109/karostartup`)
2. Go to **Settings → Secrets and variables → Actions → New repository secret**
3. Name it `SUPABASE_SERVICE_ROLE_KEY`, paste your service-role key, save
4. Go to the **Actions** tab and enable workflows if prompted

Free tier on public repos = unlimited minutes. Each run takes ~5 seconds.

**Option B — Local cron / Task Scheduler:**

Linux/Mac:
```cron
*/2 * * * * cd /path/to/karostartup && SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/update-tickers.mjs >> /tmp/tickers.log 2>&1
```

Windows: Open Task Scheduler → Create Task → Trigger every 5 min → Action: `node` with arguments `scripts\update-tickers.mjs` and the env var set.

**Option C — Supabase Edge Function:**

Port `scripts/update-tickers.mjs` to a Deno function under `supabase/functions/update-tickers/index.ts`, deploy with `supabase functions deploy update-tickers`, and schedule with `pg_cron` (Supabase has the extension enabled).

### Adding/removing symbols

Edit the `SYMBOLS` array in `scripts/update-tickers.mjs`. The Yahoo symbol format follows their convention (e.g., `^NSEI` for indices, `INR=X` for FX rates, `GC=F` for gold futures, `BTC-USD` for Bitcoin). Once added, the next cron run will upsert it.

---

## Deployment

### Vercel (recommended)
1. Push to GitHub (already wired to `https://github.com/roshanyadav-2109/karostartup`).
2. Import the repo on [vercel.com/new](https://vercel.com/new).
3. **Framework Preset:** Other. **Build command:** (leave empty). **Output directory:** `.`
4. Deploy. `vercel.json` enables clean URLs (`/about` works as well as `/about.html`).

### Netlify
1. Drag-and-drop the folder onto [app.netlify.com/drop](https://app.netlify.com/drop), or connect the GitHub repo.
2. **Build command:** (none). **Publish directory:** `/`.

### Cloudflare Pages
1. Connect the GitHub repo.
2. **Build command:** (none). **Build output directory:** `/`.

### Anywhere else
Upload the folder to any static host. There's no server-side anything.

---

## What's hardcoded vs. dynamic

| Thing | Source |
|---|---|
| All articles, categories, companies, funding rounds, comments, etc. | Supabase tables |
| Market tickers (top utility bar, full ticker, NIFTY chart header) | `market_tickers` table |
| Top gainers / losers (homepage Markets widget) | Static placeholder in `index.html` — wire up to a real API later |
| NIFTY chart line | Mocked 30 data points in `index.html` |
| Funding chart bars | Aggregated from real `funding_rounds` records |
| Hero / sector cards / long reads | Real articles, filtered by `is_featured`, `kicker`, `category_id` |
| Plus payment | Not wired. `/plus.html` "Become a Member" button redirects to `/contact.html?type=general` |
| Email sending (welcome, replies) | Not wired. Supabase Auth handles signup-confirmation; contact replies use `mailto:` |

---

## Conventions used in the code

- Every page mounts `#chrome` (utility bar + ticker + breaking + masthead + nav) via `mountChrome()` and `#footer` via `mountFooter()`.
- All user-provided strings rendered to HTML go through `escapeHtml()`. The only thing rendered as markdown is article body content via `renderMarkdown()`.
- `formatINR()`, `formatUSD()`, `formatNumber()`, `timeAgo()`, `formatDate()` etc. live in `/assets/app.js`.
- Admin pages share `/admin/shell.js` for the sidebar.
- Card renderers: `renderStoryCard()`, `renderSideCard()`, `renderStripItem()`, `renderFeedItem()`, `renderLongreadCard()`, `renderOpinionCard()` — all return HTML strings, all expect a Supabase row with optional `categories(name)` / `profiles!author_id(full_name)` joins.

---

## Brand notes

- **Brand red:** `#d10a11`. Used sparingly — accents, kickers, hover, breaking ribbon, the dot after "Karostartup".
- **No drop shadows** other than the very faint card hairline.
- **No purple, no teal, no gradients.** Editorial newspaper, not a SaaS landing page.
- Display headlines use Fraunces with the `opsz` variation axis dialed up for big sizes.
- Numbers everywhere are JetBrains Mono.

---

## License

Proprietary — Karostartup Media Pvt. Ltd.
