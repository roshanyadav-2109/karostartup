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

Role meanings:
- `reader` — default for new signups. Can comment, bookmark, subscribe to newsletters.
- `author` — can be assigned as article author. Cannot access admin yet (depends on your RLS policies).
- `editor` — can publish/edit articles, manage companies, funding, tickers, comments, submissions.
- `admin` — everything, plus user management and newsletter setup.

`requireStaff()` (client-side check in admin pages) allows `author`/`editor`/`admin`. RLS policies on your tables decide what actually persists.

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
