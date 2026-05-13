/* ============================================================
   KAROSTARTUP — Shared App Module
   Supabase client + helpers + layout renderers
   ============================================================ */

const SUPABASE_URL = 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2d3B2cW1xbWlzb2ZmYm5uamRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODYyNTEsImV4cCI6MjA5NDI2MjI1MX0.ZYBWcOGiVKV9HM3Ho2GjJ-r4XJvMITvsEK7vlEFlzVw';

const sb = window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
window.sb = sb;

/* ============================================================
   INLINE SVG ICONS (used in place of emojis)
   ============================================================ */
const ICON = {
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
  twitter: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  linkedin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/></svg>',
  whatsapp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  bookmark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
  bookmarkFill: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
  pin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  inbox: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>'
};
window.ICON = ICON;

/* ============================================================
   SESSION CACHE (sessionStorage helpers)
   ============================================================ */
function _cacheGet(key, maxAgeSec) {
  try {
    const raw = sessionStorage.getItem('k:' + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.t > maxAgeSec * 1000) return null;
    return parsed.v;
  } catch { return null; }
}
function _cacheSet(key, v) {
  try { sessionStorage.setItem('k:' + key, JSON.stringify({ t: Date.now(), v })); } catch {}
}

/* ============================================================
   AUTH HELPERS
   ============================================================ */
let _profileCache = null;
let _profileCachedFor = null;

// Fast (local-only) session check — no network call. Use for UI toggling.
async function getCurrentSession() {
  try {
    const { data } = await sb.auth.getSession();
    return data?.session || null;
  } catch { return null; }
}

// Returns the user from the locally stored session if present, otherwise null.
// No network call. Use everywhere except security-critical paths.
async function getCurrentUser() {
  try {
    const { data } = await sb.auth.getSession();
    return data?.session?.user || null;
  } catch { return null; }
}

async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) { _profileCache = null; _profileCachedFor = null; return null; }
  if (_profileCachedFor === user.id && _profileCache) return _profileCache;
  // Try sessionStorage cache (per-tab)
  const cached = _cacheGet('profile:' + user.id, 120);
  if (cached) { _profileCache = cached; _profileCachedFor = user.id; return cached; }
  try {
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) return null;
    _profileCache = data;
    _profileCachedFor = user.id;
    if (data) _cacheSet('profile:' + user.id, data);
    return data;
  } catch { return null; }
}

async function isStaff() {
  const p = await getCurrentProfile();
  if (!p) return false;
  return ['author', 'editor', 'admin'].includes(p.role);
}
async function isEditorOrAdmin() {
  const p = await getCurrentProfile();
  if (!p) return false;
  return ['editor', 'admin'].includes(p.role);
}
async function isAdmin() {
  const p = await getCurrentProfile();
  return p?.role === 'admin';
}

async function requireAuth(redirect = '/auth/signin.html') {
  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = `${redirect}?next=${next}`;
    return null;
  }
  return user;
}

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = `/auth/signin.html?next=${next}`;
    return false;
  }
  const staff = await isStaff();
  if (!staff) {
    document.body.innerHTML = `
      <div class="access-denied">
        <h1>Access denied</h1>
        <p>Your account does not have permission to view this page.</p>
        <a href="/" class="btn btn-primary">Back to homepage</a>
      </div>`;
    return false;
  }
  return true;
}

async function signOut() {
  await sb.auth.signOut();
  _profileCache = null;
  _profileCachedFor = null;
  location.href = '/';
}

/* ============================================================
   FORMATTERS
   ============================================================ */
function formatINR(n) {
  if (n == null || isNaN(n)) return '—';
  n = Number(n);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, '')} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, '')} L`;
  // full Indian-grouped number
  const str = Math.round(n).toString();
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3);
  const grouped = rest ? rest.replace(/(\d)(?=(\d\d)+$)/g, '$1,') + ',' + last3 : last3;
  return `₹${grouped}`;
}

function formatUSD(n) {
  if (n == null || isNaN(n)) return '—';
  n = Number(n);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function formatNumber(n) {
  if (n == null || isNaN(n)) return '0';
  n = Number(n);
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return Math.round(n).toString();
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  return formatDate(ts);
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })} ${d.getFullYear()}`;
}

function formatDateLong(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTimeIST(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) + ' IST';
}

function slugify(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(s) {
  if (s == null) return '';
  return s.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) { return escapeHtml(s); }

/* ============================================================
   MARKDOWN RENDERER (minimal)
   Supports: ## ### headings, **bold**, *italic*, > blockquote,
             [link](url), paragraphs, hr ---, lists - / 1.
   ============================================================ */
function renderMarkdown(md) {
  if (!md) return '';
  const esc = escapeHtml(md);
  const lines = esc.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // blank line — skip
    if (/^\s*$/.test(line)) { i++; continue; }
    // hr
    if (/^\s*---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    // h3
    if (/^###\s+/.test(line)) { out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`); i++; continue; }
    // h2
    if (/^##\s+/.test(line)) { out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`); i++; continue; }
    // blockquote
    if (/^>\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s+/.test(lines[i])) {
        buf.push(inline(lines[i].replace(/^>\s+/, '')));
        i++;
      }
      out.push(`<blockquote class="blockquote-pull">${buf.join('<br>')}</blockquote>`);
      continue;
    }
    // unordered list
    if (/^[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        buf.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${buf.join('')}</ul>`);
      continue;
    }
    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        buf.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${buf.join('')}</ol>`);
      continue;
    }
    // paragraph
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(##|###|>|---+|[-*]\s|\d+\.\s)/.test(lines[i])) {
      buf.push(inline(lines[i]));
      i++;
    }
    if (buf.length) out.push(`<p>${buf.join(' ')}</p>`);
  }
  return out.join('\n');

  function inline(s) {
    // links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
    // bold
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italic
    s = s.replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, '$1<em>$2</em>');
    return s;
  }
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, type = 'success', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/* ============================================================
   REVEAL ANIMATION
   ============================================================ */
function initReveal() {
  // No-op. The .reveal class is kept as a hook for future animations,
  // but we don't hide content by default — async-loaded content was
  // staying invisible because the observer ran before data rendered.
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-revealed'));
}

/* ============================================================
   LAYOUT RENDERERS
   ============================================================ */
function renderUtilityBar(tickers) {
  const date = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const chips = (tickers || []).slice(0, 3).map(t => {
    const dir = (t.change_percent || 0) >= 0 ? 'up' : 'down';
    const arrow = dir === 'up' ? '▲' : '▼';
    return `<span class="quick-chip"><span class="sym">${escapeHtml(t.symbol)}</span> <span class="val">${formatNumber(t.value)}</span> <span class="${dir}">${arrow}${Math.abs(t.change_percent || 0).toFixed(2)}%</span></span>`;
  }).join('');
  return `
  <div class="utility-bar">
    <div class="container">
      <div class="utility-bar-left">
        <span class="date">${date}</span>
        <div class="quick-chips">${chips}</div>
      </div>
      <div class="utility-bar-right" id="utility-auth-slot">
        <a href="/auth/signin.html">Sign in</a>
      </div>
    </div>
  </div>`;
}

function renderTicker(tickers) {
  if (!tickers || !tickers.length) return '';
  const items = tickers.map(t => {
    const dir = (t.change_percent || 0) >= 0 ? 'up' : 'down';
    const arrow = dir === 'up' ? '▲' : '▼';
    return `<span class="ticker-item">
      <span class="sym">${escapeHtml(t.display_name || t.symbol)}</span>
      <span class="val">${formatNumber(t.value)}</span>
      <span class="chg ${dir}"><span class="arrow">${arrow}</span> ${(t.change_value || 0) >= 0 ? '+' : ''}${Number(t.change_value || 0).toFixed(2)} (${Math.abs(t.change_percent || 0).toFixed(2)}%)</span>
    </span>`;
  }).join('');
  return `
  <div class="ticker-bar">
    <div class="ticker-track">${items}${items}</div>
  </div>`;
}

function renderBreakingFromData(data) {
  if (!data || !data.length) return '';
  const headlines = data.map(a => `<a href="/article/view.html?slug=${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a>`).join('<span style="opacity:0.4;">•</span>');
  return `
  <div class="breaking-ribbon">
    <div class="container">
      <span class="breaking-pill">Breaking</span>
      <div class="breaking-headlines">${headlines}${headlines}</div>
    </div>
  </div>`;
}

function renderMasthead() {
  return `
  <div class="masthead">
    <div class="container">
      <div class="masthead-left">
        <a href="/about.html">About</a>
        <a href="/newsletters.html">Newsletters</a>
        <a href="/contact.html">Contact</a>
      </div>
      <a href="/" class="logo">Karostartup<span class="dot"></span></a>
      <div class="masthead-right">
        <a href="/plus.html" class="plus-link">Plus</a>
        <a href="/search.html" class="search-btn" aria-label="Search">${ICON.search} <span>Search</span></a>
      </div>
    </div>
  </div>`;
}

function renderNavFromData(categories, activeSlug = '') {
  const cats = (categories || []).map(c => `<a href="/category/view.html?slug=${encodeURIComponent(c.slug)}" ${c.slug === activeSlug ? 'class="is-active"' : ''}>${escapeHtml(c.name)}</a>`).join('');
  return `
  <nav class="nav">
    <div class="container">
      <div class="nav-links">
        <a href="/" ${activeSlug === '' ? 'class="is-active"' : ''}>Home</a>
        ${cats}
      </div>
      <a href="/contact.html?type=promotion" class="nav-promote">Promote with us →</a>
    </div>
  </nav>`;
}

function renderFooter() {
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="logo">Karostartup<span class="dot"></span></div>
          <p>India's business of business. Founder-first journalism from the frontlines of the startup economy.</p>
          <a href="/plus.html" class="btn btn-red btn-sm">Join Plus</a>
        </div>
        <div class="footer-col">
          <h4>Sections</h4>
          <ul id="footer-cats">
            <li><a href="/">Home</a></li>
            <li><a href="/category/view.html?slug=fintech">Fintech</a></li>
            <li><a href="/category/view.html?slug=saas">SaaS</a></li>
            <li><a href="/category/view.html?slug=d2c">D2C</a></li>
            <li><a href="/category/view.html?slug=ai">AI</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Company</h4>
          <ul>
            <li><a href="/about.html">About us</a></li>
            <li><a href="/contact.html?type=careers">Careers</a></li>
            <li><a href="/contact.html">Contact</a></li>
            <li><a href="/plus.html">Plus membership</a></li>
            <li><a href="/newsletters.html">Newsletters</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Reach Us</h4>
          <ul>
            <li><a href="/contact.html?type=promotion">Promote your startup</a></li>
            <li><a href="/contact.html?type=advertise">Advertise</a></li>
            <li><a href="/contact.html?type=tip">Send a tip</a></li>
            <li><a href="/contact.html?type=pr">PR / Press</a></li>
            <li><a href="/contact.html?type=partnership">Partnership</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Follow</h4>
          <ul>
            <li><a href="https://twitter.com/karostartup" target="_blank" rel="noopener">X (Twitter)</a></li>
            <li><a href="https://linkedin.com" target="_blank" rel="noopener">LinkedIn</a></li>
            <li><a href="https://youtube.com" target="_blank" rel="noopener">YouTube</a></li>
            <li><a href="https://instagram.com" target="_blank" rel="noopener">Instagram</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div>© ${new Date().getFullYear()} Karostartup. All rights reserved.</div>
        <div class="socials">
          <a href="/about.html">Privacy</a>
          <a href="/about.html">Terms</a>
          <a href="/about.html">Sitemap</a>
        </div>
      </div>
    </div>
  </footer>`;
}

async function mountChrome(activeSlug = '') {
  const slot = document.getElementById('chrome');
  if (!slot) return;

  // 1. Read sessionStorage cache and local session SYNCHRONOUSLY for instant first paint.
  const cachedTickers = _cacheGet('tickers', 60);
  const cachedCats = _cacheGet('categories', 300);
  const cachedBreaking = _cacheGet('breaking', 60);

  // 2. First paint with whatever we have (or skeletons).
  slot.innerHTML =
    renderUtilityBar(cachedTickers || []) +
    renderTicker(cachedTickers || []) +
    (cachedBreaking ? renderBreakingFromData(cachedBreaking) : '') +
    renderMasthead() +
    renderNavFromData(cachedCats || [], activeSlug);

  // Wire signout if signed in (read from session synchronously)
  const session = await getCurrentSession();
  const authSlot = document.getElementById('utility-auth-slot');
  if (authSlot && session?.user) {
    const cachedProfile = _cacheGet('profile:' + session.user.id, 120);
    const staffLink = cachedProfile && ['author', 'editor', 'admin'].includes(cachedProfile.role)
      ? `<a href="/admin/">Admin</a>` : '';
    authSlot.innerHTML = `${staffLink}<a href="/profile.html">Profile</a> <a href="#" id="signout-link">Sign out</a>`;
    const so = document.getElementById('signout-link');
    if (so) so.addEventListener('click', (e) => { e.preventDefault(); signOut(); });
  }

  // 3. In the background, refresh the data in parallel and patch the DOM.
  const since24h = new Date(Date.now() - 86400000).toISOString();
  const promises = [
    cachedTickers ? Promise.resolve({ data: cachedTickers }) :
      sb.from('market_tickers').select('*').order('order_index', { ascending: true }),
    cachedCats ? Promise.resolve({ data: cachedCats }) :
      sb.from('categories').select('slug,name').order('order_index', { ascending: true }),
    sb.from('articles').select('slug,title').eq('is_breaking', true).eq('status', 'published').gte('published_at', since24h).order('published_at', { ascending: false }).limit(6),
    session?.user && !_cacheGet('profile:' + session.user.id, 120)
      ? sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      : Promise.resolve({ data: null })
  ];

  Promise.all(promises).then(([tRes, cRes, bRes, pRes]) => {
    const tickers = tRes.data || [];
    const cats = cRes.data || [];
    const breaking = bRes.data || [];
    if (!cachedTickers) _cacheSet('tickers', tickers);
    if (!cachedCats) _cacheSet('categories', cats);
    _cacheSet('breaking', breaking);

    // Patch ticker bar
    const tickerEls = slot.querySelectorAll('.ticker-bar, .utility-bar');
    if (!cachedTickers && tickers.length) {
      const ub = slot.querySelector('.utility-bar');
      const tb = slot.querySelector('.ticker-bar');
      if (ub) ub.outerHTML = renderUtilityBar(tickers);
      if (tb) tb.outerHTML = renderTicker(tickers);
      else slot.querySelector('.utility-bar').insertAdjacentHTML('afterend', renderTicker(tickers));
    }
    // Patch breaking
    const existingBreaking = slot.querySelector('.breaking-ribbon');
    if (breaking.length) {
      const html = renderBreakingFromData(breaking);
      if (existingBreaking) existingBreaking.outerHTML = html;
      else slot.querySelector('.masthead').insertAdjacentHTML('beforebegin', html);
    } else if (existingBreaking) {
      existingBreaking.remove();
    }
    // Patch nav
    const nav = slot.querySelector('.nav');
    if (!cachedCats && cats.length && nav) nav.outerHTML = renderNavFromData(cats, activeSlug);

    // Patch profile (cache it)
    if (pRes.data && session?.user) {
      _cacheSet('profile:' + session.user.id, pRes.data);
      _profileCache = pRes.data;
      _profileCachedFor = session.user.id;
      const slot2 = document.getElementById('utility-auth-slot');
      if (slot2 && ['author', 'editor', 'admin'].includes(pRes.data.role) && !slot2.querySelector('a[href="/admin/"]')) {
        const sl = document.getElementById('signout-link');
        slot2.insertAdjacentHTML('afterbegin', `<a href="/admin/">Admin</a> `);
        // re-wire signout (since innerHTML wasn't re-set, link still exists)
      }
    }
  }).catch(() => {});
}

function mountFooter() {
  const slot = document.getElementById('footer');
  if (slot) slot.innerHTML = renderFooter();
  // Use cached categories if we have them; else fetch.
  const cached = _cacheGet('categories', 300);
  const apply = (cats) => {
    const ul = document.getElementById('footer-cats');
    if (!ul || !cats || !cats.length) return;
    ul.innerHTML = cats.slice(0, 6).map(c => `<li><a href="/category/view.html?slug=${encodeURIComponent(c.slug)}">${escapeHtml(c.name)}</a></li>`).join('');
  };
  if (cached) apply(cached);
  else {
    sb.from('categories').select('slug,name').order('order_index', { ascending: true }).limit(6).then(({ data }) => {
      if (data) _cacheSet('categories', data);
      apply(data);
    }).catch(() => {});
  }
}

/* ============================================================
   CARD RENDERERS
   ============================================================ */
function articleHref(a) { return `/article/view.html?slug=${encodeURIComponent(a.slug)}`; }

function defaultCover(a) {
  // simple solid colored placeholder with title initials
  const seed = (a.title || a.slug || 'k').charCodeAt(0) % 6;
  const colors = ['#0a0a0a', '#d10a11', '#1a1a1a', '#0b5394', '#8a3ffc', '#0a7a3b'];
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 10'><rect width='16' height='10' fill='${colors[seed]}'/><text x='8' y='5.8' font-family='Georgia' font-size='4' fill='white' text-anchor='middle' font-weight='bold'>K.</text></svg>`)}`;
}

function renderStoryCard(a, opts = {}) {
  if (!a) return '';
  const cover = a.cover_image_url || defaultCover(a);
  const klass = opts.small ? 'story-card small' : 'story-card';
  const author = a.profiles?.full_name || a.author_name || '';
  const cat = a.categories?.name || '';
  return `
  <a href="${articleHref(a)}" class="${klass} reveal">
    <img src="${escapeAttr(cover)}" class="cover" alt="${escapeAttr(a.title)}" loading="lazy">
    ${a.kicker ? `<span class="kicker">${escapeHtml(a.kicker)}</span>` : (cat ? `<span class="kicker">${escapeHtml(cat)}</span>` : '')}
    <h2 class="title">${escapeHtml(a.title)}</h2>
    ${!opts.small && a.summary ? `<p class="summary">${escapeHtml(a.summary)}</p>` : ''}
    <div class="meta">
      ${author ? `<span class="author">${escapeHtml(author)}</span>` : ''}
      ${author ? '<span class="dot"></span>' : ''}
      <span>${timeAgo(a.published_at || a.created_at)}</span>
      ${a.read_time_minutes ? `<span class="dot"></span><span>${a.read_time_minutes} min read</span>` : ''}
    </div>
  </a>`;
}

function renderSideCard(a) {
  if (!a) return '';
  const cover = a.cover_image_url || defaultCover(a);
  const cat = a.categories?.name || '';
  return `
  <a href="${articleHref(a)}" class="side-card reveal">
    <div>
      ${a.kicker ? `<span class="kicker">${escapeHtml(a.kicker)}</span>` : (cat ? `<span class="kicker">${escapeHtml(cat)}</span>` : '')}
      <h3 class="title">${escapeHtml(a.title)}</h3>
      <div class="meta">${timeAgo(a.published_at || a.created_at)}</div>
    </div>
    <img src="${escapeAttr(cover)}" class="thumb" alt="${escapeAttr(a.title)}" loading="lazy">
  </a>`;
}

function renderStripItem(a) {
  if (!a) return '';
  const cat = a.categories?.name || '';
  return `
  <a href="${articleHref(a)}" class="strip-item reveal">
    ${a.kicker ? `<span class="kicker">${escapeHtml(a.kicker)}</span>` : (cat ? `<span class="kicker">${escapeHtml(cat)}</span>` : '')}
    <h3 class="title">${escapeHtml(a.title)}</h3>
    <div class="meta">${timeAgo(a.published_at || a.created_at)}</div>
  </a>`;
}

function renderFeedItem(a) {
  if (!a) return '';
  const cover = a.cover_image_url || defaultCover(a);
  const author = a.profiles?.full_name || '';
  const cat = a.categories?.name || '';
  return `
  <a href="${articleHref(a)}" class="feed-item reveal">
    <div>
      ${a.kicker ? `<span class="kicker">${escapeHtml(a.kicker)}</span>` : (cat ? `<span class="kicker">${escapeHtml(cat)}</span>` : '')}
      <h3 class="title">${escapeHtml(a.title)}</h3>
      ${a.summary ? `<p class="summary">${escapeHtml(a.summary)}</p>` : ''}
      <div class="meta">
        ${author ? `<span style="color:#0a0a0a;font-weight:600;">${escapeHtml(author)}</span><span class="dot"></span>` : ''}
        <span>${timeAgo(a.published_at || a.created_at)}</span>
        ${a.read_time_minutes ? `<span class="dot"></span><span>${a.read_time_minutes} min</span>` : ''}
        ${a.view_count ? `<span class="dot"></span><span>${formatNumber(a.view_count)} views</span>` : ''}
      </div>
    </div>
    <img src="${escapeAttr(cover)}" class="thumb" alt="${escapeAttr(a.title)}" loading="lazy">
  </a>`;
}

function renderLongreadCard(a) {
  if (!a) return '';
  const cover = a.cover_image_url || defaultCover(a);
  return `
  <a href="${articleHref(a)}" class="longread-card reveal">
    <div class="cover-wrap"><img src="${escapeAttr(cover)}" class="cover" alt="${escapeAttr(a.title)}" loading="lazy"></div>
    ${a.kicker ? `<span class="kicker">${escapeHtml(a.kicker)}</span>` : ''}
    <h3 class="title">${escapeHtml(a.title)}</h3>
    ${a.summary ? `<p class="summary">${escapeHtml(a.summary)}</p>` : ''}
  </a>`;
}

function renderOpinionCard(a) {
  if (!a) return '';
  const author = a.profiles || {};
  const avatar = author.avatar_url || defaultCover({title: author.full_name || 'A'});
  return `
  <a href="${articleHref(a)}" class="opinion-card reveal">
    <div class="author-row">
      <img src="${escapeAttr(avatar)}" class="author-avatar" alt="${escapeAttr(author.full_name || '')}">
      <div>
        <div class="author-name">${escapeHtml(author.full_name || 'Columnist')}</div>
        <div class="author-role">Opinion</div>
      </div>
    </div>
    <h3 class="title">${escapeHtml(a.title)}</h3>
    ${a.summary ? `<p class="dek">${escapeHtml(a.summary)}</p>` : ''}
  </a>`;
}

function statusPill(status) {
  return `<span class="status-pill ${status}">${escapeHtml((status || '').replace('_', ' '))}</span>`;
}
function typePill(t) {
  return `<span class="type-pill ${t}">${escapeHtml(t || '')}</span>`;
}
function roundPillClass(r) {
  return (r || '').toLowerCase().replace(/\s+/g, '-').replace('+', '-plus');
}

/* ============================================================
   PAGE READY
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // small delay so renderers can fire
  setTimeout(initReveal, 100);
});

/* ============================================================
   EXPORTS (already on window)
   ============================================================ */
window.k = {
  sb, getCurrentUser, getCurrentSession, getCurrentProfile, isStaff, isEditorOrAdmin, isAdmin,
  requireAuth, requireStaff, signOut,
  formatINR, formatUSD, formatNumber, timeAgo, formatDate, formatDateLong, formatTimeIST,
  slugify, escapeHtml, escapeAttr, renderMarkdown, showToast, initReveal,
  mountChrome, mountFooter, ICON,
  renderStoryCard, renderSideCard, renderStripItem, renderFeedItem, renderLongreadCard, renderOpinionCard,
  statusPill, typePill, roundPillClass, defaultCover, articleHref
};
