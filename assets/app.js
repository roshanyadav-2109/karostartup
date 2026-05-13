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
   AUTH HELPERS
   ============================================================ */
let _profileCache = null;
let _profileCachedFor = null;

async function getCurrentUser() {
  try {
    const { data } = await sb.auth.getUser();
    return data?.user || null;
  } catch { return null; }
}

async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) { _profileCache = null; _profileCachedFor = null; return null; }
  if (_profileCachedFor === user.id && _profileCache) return _profileCache;
  try {
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) return null;
    _profileCache = data;
    _profileCachedFor = user.id;
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
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-revealed'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-revealed');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.05 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
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

async function renderBreaking() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await sb.from('articles')
      .select('slug,title')
      .eq('is_breaking', true)
      .eq('status', 'published')
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(6);
    if (!data || !data.length) return '';
    const headlines = data.map(a => `<a href="/article/view.html?slug=${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a>`).join('<span style="opacity:0.4;">•</span>');
    return `
    <div class="breaking-ribbon">
      <div class="container">
        <span class="breaking-pill">Breaking</span>
        <div class="breaking-headlines">${headlines}${headlines}</div>
      </div>
    </div>`;
  } catch { return ''; }
}

async function renderMasthead() {
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
        <a href="/search.html" class="search-btn" aria-label="Search">🔍 Search</a>
      </div>
    </div>
  </div>`;
}

async function renderNav(activeSlug = '') {
  let categories = [];
  try {
    const { data } = await sb.from('categories').select('slug,name').order('order_index', { ascending: true });
    categories = data || [];
  } catch {}
  const cats = categories.map(c => `<a href="/category/view.html?slug=${encodeURIComponent(c.slug)}" ${c.slug === activeSlug ? 'class="is-active"' : ''}>${escapeHtml(c.name)}</a>`).join('');
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
  let tickers = [];
  try {
    const { data } = await sb.from('market_tickers').select('*').order('order_index', { ascending: true });
    tickers = data || [];
  } catch {}
  const breaking = await renderBreaking();
  slot.innerHTML = renderUtilityBar(tickers) + renderTicker(tickers) + breaking + (await renderMasthead()) + (await renderNav(activeSlug));

  // Swap auth slot
  const authSlot = document.getElementById('utility-auth-slot');
  if (authSlot) {
    const user = await getCurrentUser();
    if (user) {
      const profile = await getCurrentProfile();
      const staffLink = profile && ['author', 'editor', 'admin'].includes(profile.role)
        ? `<a href="/admin/">Admin</a>`
        : '';
      authSlot.innerHTML = `
        ${staffLink}
        <a href="/profile.html">Profile</a>
        <a href="#" id="signout-link">Sign out</a>`;
      const so = document.getElementById('signout-link');
      if (so) so.addEventListener('click', (e) => { e.preventDefault(); signOut(); });
    }
  }
}

function mountFooter() {
  const slot = document.getElementById('footer');
  if (slot) slot.innerHTML = renderFooter();
  // populate footer categories
  sb.from('categories').select('slug,name').order('order_index', { ascending: true }).limit(6).then(({ data }) => {
    const ul = document.getElementById('footer-cats');
    if (!ul || !data || !data.length) return;
    ul.innerHTML = data.map(c => `<li><a href="/category/view.html?slug=${encodeURIComponent(c.slug)}">${escapeHtml(c.name)}</a></li>`).join('');
  }).catch(() => {});
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
  sb, getCurrentUser, getCurrentProfile, isStaff, isEditorOrAdmin, isAdmin,
  requireAuth, requireStaff, signOut,
  formatINR, formatUSD, formatNumber, timeAgo, formatDate, formatDateLong, formatTimeIST,
  slugify, escapeHtml, escapeAttr, renderMarkdown, showToast, initReveal,
  mountChrome, mountFooter,
  renderStoryCard, renderSideCard, renderStripItem, renderFeedItem, renderLongreadCard, renderOpinionCard,
  statusPill, typePill, roundPillClass, defaultCover, articleHref
};
