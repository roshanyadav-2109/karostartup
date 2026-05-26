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

// If a cover/thumb image fails to load, hide the image AND its immediate
// wrapper so the card collapses instead of showing the browser's broken-image
// "envelope" placeholder. Covers any <img> nested in a known cover/thumb wrap
// class. Anchored profile/logo avatars are excluded — they have their own
// fallback styling and shouldn't collapse.
const _IMG_HIDE_WRAP_CLASSES = [
  'hero-lead-img', 'hero-update-thumb', 'lnews-side-img', 'lnews-feature-img',
  'topic-tile-img', 'pod-cover-wrap', 'cover-wrap', 'cover-media', 'thumb-media',
  'short-tile-thumb',
];
window.addEventListener('error', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLImageElement)) return;
  // Avoid loops if a fallback also fails.
  if (t.dataset.errorHandled) return;
  t.dataset.errorHandled = '1';
  t.style.display = 'none';
  t.removeAttribute('src');
  const parent = t.parentElement;
  if (parent && _IMG_HIDE_WRAP_CLASSES.some(c => parent.classList && parent.classList.contains(c))) {
    parent.style.display = 'none';
  }
}, true);

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
  inbox: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  printer: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  linkedinSm: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/></svg>',
  instagram: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
  youtube: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  facebook: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 8h-3v4h3v12h5v-12h3.642L18 8h-4V6.333C14 5.378 14.192 5 15.115 5H18V0h-3.808C10.596 0 9 1.583 9 4.615V8z"/></svg>',
  podcast: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  mail: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 7 12 13 2 7"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5"/></svg>',
  threads: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.78 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.745-1.757-.513-.586-1.305-.883-2.354-.89h-.032c-.838 0-1.973.226-2.698 1.31L7.793 6.847c.97-1.45 2.548-2.25 4.443-2.25h.046c3.172.019 5.062 1.954 5.25 5.323.108.045.216.092.32.141 1.469.692 2.544 1.74 3.108 3.029.787 1.802.86 4.741-1.541 7.097-1.836 1.8-4.06 2.611-7.214 2.634m-2.137-10.225c-.78.062-2.79.392-2.703 1.97.022.422.166.74.45.97.435.355 1.157.495 2.064.443 1.05-.057 1.886-.347 2.36-.834.366-.377.567-.834.633-1.45a10.27 10.27 0 0 0-2.453-.16 7.21 7.21 0 0 0-.351.061"/></svg>'
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

// Start Google OAuth via Supabase Auth. Returns to `next` (a same-site path)
// after the round-trip through Google + the Supabase callback.
async function signInWithGoogle(next = '/') {
  const safe = (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) ? next : '/';
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: location.origin + safe,
      queryParams: { prompt: 'select_account' },
    },
  });
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
// Build a YouTube / Vimeo embed iframe with autoplay (muted) params. Browsers
// require muted autoplay for unattended play, so all autoplay embeds start
// muted and the user can unmute.
function _ytEmbed(id) {
  const src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&rel=0&playsinline=1`;
  return `<div class="embed-video"><iframe src="${src}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
}
function _vimeoEmbed(id) {
  const src = `https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=1&muted=1`;
  return `<div class="embed-video"><iframe src="${src}" title="Vimeo video" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
}
// Return the video ID for a YouTube URL (any of the common shapes), or null.
function _ytIdFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
      if (u.pathname.startsWith('/embed/'))  return u.pathname.split('/')[2] || null;
    }
  } catch {}
  return null;
}
function _vimeoIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, '') !== 'vimeo.com') return null;
    const id = u.pathname.split('/').filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? id : null;
  } catch { return null; }
}

// Convert a bare media URL on its own line to an embed iframe HTML.
// Returns null if the URL isn't recognised as embeddable.
function _mediaEmbedFor(url) {
  try {
    const ytId = _ytIdFromUrl(url);
    if (ytId) return _ytEmbed(ytId);
    const vmId = _vimeoIdFromUrl(url);
    if (vmId) return _vimeoEmbed(vmId);
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    // Spotify — episodes, shows, tracks
    if (host === 'open.spotify.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return `<div class="embed-audio"><iframe src="https://open.spotify.com/embed/${parts[0]}/${parts[1]}" title="Spotify embed" allow="encrypted-media; autoplay; clipboard-write; picture-in-picture" loading="lazy"></iframe></div>`;
      }
    }
    // Apple Podcasts
    if (host === 'podcasts.apple.com') {
      return `<div class="embed-audio embed-audio-apple"><iframe src="https://embed.podcasts.apple.com${u.pathname}${u.search}" title="Apple Podcasts embed" allow="autoplay *; encrypted-media *; clipboard-write" loading="lazy"></iframe></div>`;
    }
    // SoundCloud
    if (host === 'soundcloud.com') {
      return `<div class="embed-audio"><iframe src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23d10a11&inverse=false&auto_play=false&show_user=true" title="SoundCloud embed" loading="lazy"></iframe></div>`;
    }
    // Direct audio file (mp3/m4a/ogg/wav)
    if (/\.(mp3|m4a|ogg|wav)(\?.*)?$/i.test(u.pathname)) {
      return `<audio class="embed-audio-native" controls preload="metadata" src="${escapeAttr(url)}"></audio>`;
    }
  } catch {}
  return null;
}

// Strip dangerous tags + ugly Google-Docs inline styles from imported
// legacy HTML so it renders as readable prose instead of as escaped tags.
// Browser-side only — uses DOMParser. Trusted-source content only (the
// legacy karostartup MySQL dump); not designed for arbitrary user input.
const _SAFE_TAGS = new Set([
  'p','br','hr','div','span',
  'h1','h2','h3','h4','h5','h6',
  'ul','ol','li','dl','dt','dd',
  'blockquote','pre','code','em','i','strong','b','u','s','del','ins','sub','sup','small','mark',
  'a','img','figure','figcaption',
  'table','thead','tbody','tfoot','tr','td','th','caption','colgroup','col',
]);
function sanitizeImportedHtml(html) {
  try {
    const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html');
    const root = doc.getElementById('__root');

    // Helper: build an embed iframe element from a video URL, or null.
    const videoEmbedElement = (url) => {
      const embedHtml = _mediaEmbedFor(url);
      if (!embedHtml) return null;
      const wrap = doc.createElement('div');
      wrap.innerHTML = embedHtml;
      return wrap.firstElementChild;
    };

    // Block-level tags whose siblings make natural insertion points for
    // video embeds — when a link or bare URL appears inside one of these,
    // the embed is appended AFTER the block so the surrounding text flows
    // uninterrupted.
    const _BLOCK_TAGS = new Set(['p','h1','h2','h3','h4','h5','h6','li','blockquote','div','figure','section','article']);
    const closestBlockAncestor = (node) => {
      let n = node.parentNode;
      while (n && n !== root) {
        if (n.nodeType === 1 && _BLOCK_TAGS.has(n.tagName.toLowerCase())) return n;
        n = n.parentNode;
      }
      return null;
    };
    // Queue + dedupe (per-block per-URL) so multiple references to the same
    // video in one paragraph still produce only one embed below it.
    const pending = []; // { block, url, embed }
    const seen = new WeakMap();
    const queueEmbedAfter = (block, url, embed) => {
      if (!block || !url || !embed) return;
      let urls = seen.get(block);
      if (!urls) { urls = new Set(); seen.set(block, urls); }
      if (urls.has(url)) return; // dedupe
      urls.add(url);
      pending.push({ block, embed });
    };

    const walk = (node) => {
      // children snapshot so we can mutate while iterating
      const kids = [...node.childNodes];
      for (const child of kids) {
        if (child.nodeType === 3 /* text */) {
          // Bare YouTube/Vimeo URL in text — leave the URL as-is in the
          // paragraph; the embed goes AFTER the parent block.
          const text = child.nodeValue || '';
          const m = text.match(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)[\w-]+|youtu\.be\/[\w-]+|vimeo\.com\/\d+)[^\s<)\]]*/i);
          if (m) {
            const block = closestBlockAncestor(child);
            queueEmbedAfter(block, m[0], videoEmbedElement(m[0]));
          }
          continue;
        }
        if (child.nodeType !== 1 /* element */) continue;

        const tag = child.tagName.toLowerCase();

        // <iframe> from a trusted video host — replace inline (it was
        // already meant to be an embed, just normalize + add autoplay).
        if (tag === 'iframe') {
          const src = child.getAttribute('src') || '';
          const embed = videoEmbedElement(src);
          if (embed) { child.replaceWith(embed); continue; }
          child.remove();
          continue;
        }

        // <a href="video"> — keep the link as text in the paragraph; the
        // embed goes AFTER the parent block, not in place of the link.
        if (tag === 'a') {
          const href = child.getAttribute('href') || '';
          if (href) {
            const block = closestBlockAncestor(child);
            if (block) queueEmbedAfter(block, href, videoEmbedElement(href));
          }
        }

        if (!_SAFE_TAGS.has(tag)) {
          // Replace disallowed element with its text (drop scripts/styles/forms
          // completely; keep text content for everything else)
          if (tag === 'script' || tag === 'style' || tag === 'object' ||
              tag === 'embed'  || tag === 'form'  || tag === 'input'  ||
              tag === 'link'   || tag === 'meta') {
            child.remove();
          } else {
            const text = doc.createTextNode(child.textContent || '');
            child.replaceWith(text);
          }
          continue;
        }
        // Strip dangerous + noisy attributes
        for (const attr of [...child.attributes]) {
          const name = attr.name.toLowerCase();
          const val  = attr.value;
          if (name.startsWith('on'))                            { child.removeAttribute(attr.name); continue; }
          if (name === 'style')                                 { child.removeAttribute(attr.name); continue; }
          if (name === 'class')                                 { child.removeAttribute(attr.name); continue; }
          if (name === 'dir' || name === 'lang' || name === 'id'){ child.removeAttribute(attr.name); continue; }
          if ((name === 'href' || name === 'src') &&
              /^\s*javascript:/i.test(val))                     { child.removeAttribute(attr.name); continue; }
        }
        // Make external links open in a new tab safely
        if (tag === 'a' && child.getAttribute('href')) {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
        }
        // Drop completely empty paragraphs/spans/divs (Google-Docs litter)
        if ((tag === 'p' || tag === 'span' || tag === 'div') &&
            !child.textContent.trim() &&
            !child.querySelector('img,iframe,video,audio,br,hr')) {
          child.remove();
          continue;
        }
        walk(child);
        // After recursion, unwrap useless single-child <span> wrappers
        if (tag === 'span' && child.attributes.length === 0) {
          while (child.firstChild) child.parentNode.insertBefore(child.firstChild, child);
          child.remove();
        }
      }
    };
    walk(root);
    // Flush queued embeds: each one goes immediately after its block.
    // Multiple pending embeds for the same block append in insertion order.
    for (const { block, embed } of pending) {
      if (!block || !block.parentNode) continue;
      block.parentNode.insertBefore(embed, block.nextSibling);
    }
    return root.innerHTML;
  } catch (e) {
    console.warn('[sanitizeImportedHtml]', e?.message || e);
    return escapeHtml(html);
  }
}

function renderMarkdown(md) {
  if (!md) return '';
  // Imported legacy articles store full HTML. Detect that — anything starting
  // with a structural HTML tag goes through the sanitizer instead of the
  // markdown pass (otherwise escapeHtml() shows the raw <p>/<span> markup).
  const stripped = String(md).trim();
  if (/^<(p|div|h[1-6]|ul|ol|table|blockquote|img|figure|section|article)\b/i.test(stripped)) {
    return sanitizeImportedHtml(stripped);
  }
  const rawLines = md.split(/\r?\n/);
  // First pass: handle bare-URL lines BEFORE escaping, so iframe HTML survives.
  // Build a marker list that the per-line renderer below treats as a passthrough.
  const passthrough = [];
  const cooked = rawLines.map((line) => {
    const trimmed = line.trim();
    if (/^https?:\/\/\S+$/.test(trimmed)) {
      const embed = _mediaEmbedFor(trimmed);
      if (embed) {
        passthrough.push(embed);
        return ` PASS${passthrough.length - 1} `;
      }
    }
    return line;
  });
  const esc = escapeHtml(cooked.join('\n'));
  // Restore passthrough markers AFTER escapeHtml so the HTML is preserved
  const restored = esc.replace(/ PASS(\d+) /g, (_, n) => passthrough[Number(n)] || '');
  const lines = restored.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // blank line — skip
    if (/^\s*$/.test(line)) { i++; continue; }
    // passthrough (already-rendered embed)
    if (/^<(div|audio|iframe)/.test(line.trim())) { out.push(line); i++; continue; }
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
   SEO META — Open Graph, Twitter Cards, canonical URL, JSON-LD.
   Every page should call setMeta() once after its data loads.
   Earlier static <meta> tags in the page <head> are kept as
   fallbacks; setMeta() upserts/overrides them with live data.
   ============================================================ */
const SITE_NAME = 'Karostartup';
const SITE_DESCRIPTION = "India's business of business — sharp, founder-first journalism on startups, funding, and the operators building India.";
const SITE_TWITTER = '@karo_startup';
const SITE_DEFAULT_OG_IMAGE = '/assets/logo-wordmark.png';

function _absoluteUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return location.protocol + u;
  if (u.startsWith('/')) return location.origin + u;
  return location.origin + '/' + u;
}

function _upsertMeta(attrName, attrValue, content) {
  if (content == null || content === '') return;
  let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function _removeMeta(attrName, attrValue) {
  document.querySelectorAll(`meta[${attrName}="${attrValue}"]`).forEach(el => el.remove());
}

function setMeta(opts = {}) {
  const {
    title,
    description = SITE_DESCRIPTION,
    image,
    type = 'website',             // 'article' on article pages
    url,
    canonical,
    noindex = false,
    twitterCard = 'summary_large_image',
    keywords,                     // optional comma-string
    article,                      // optional: { author, publishedTime, modifiedTime, section, tags[] }
    jsonLd,                       // a single object or an array — injected as <script type="application/ld+json">
  } = opts;

  const pageUrl = _absoluteUrl(canonical || url || location.pathname + location.search);
  const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  document.title = fullTitle;

  // <meta name="description"> + keywords + robots
  _upsertMeta('name', 'description', description);
  if (keywords) _upsertMeta('name', 'keywords', keywords);
  _upsertMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large');
  _upsertMeta('name', 'theme-color', '#0a0a0a');

  // Canonical link
  let canonEl = document.querySelector('link[rel="canonical"]');
  if (!canonEl) {
    canonEl = document.createElement('link');
    canonEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonEl);
  }
  canonEl.setAttribute('href', pageUrl);

  // Open Graph
  _upsertMeta('property', 'og:site_name', SITE_NAME);
  _upsertMeta('property', 'og:type', type);
  _upsertMeta('property', 'og:url', pageUrl);
  _upsertMeta('property', 'og:title', title || SITE_NAME);
  _upsertMeta('property', 'og:description', description);
  _upsertMeta('property', 'og:locale', 'en_IN');
  const ogImg = _absoluteUrl(image || SITE_DEFAULT_OG_IMAGE);
  if (ogImg) {
    _upsertMeta('property', 'og:image', ogImg);
    _upsertMeta('property', 'og:image:alt', title || SITE_NAME);
  } else {
    _removeMeta('property', 'og:image');
    _removeMeta('property', 'og:image:alt');
  }

  // Article-specific OG
  if (type === 'article' && article) {
    if (article.publishedTime) _upsertMeta('property', 'article:published_time', article.publishedTime);
    if (article.modifiedTime)  _upsertMeta('property', 'article:modified_time',  article.modifiedTime);
    if (article.author)        _upsertMeta('property', 'article:author',         article.author);
    if (article.section)       _upsertMeta('property', 'article:section',        article.section);
    document.querySelectorAll('meta[property="article:tag"]').forEach(el => el.remove());
    (article.tags || []).forEach((t) => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'article:tag');
      m.setAttribute('content', t);
      document.head.appendChild(m);
    });
  }

  // Twitter Cards
  _upsertMeta('name', 'twitter:card', twitterCard);
  _upsertMeta('name', 'twitter:site', SITE_TWITTER);
  _upsertMeta('name', 'twitter:title', title || SITE_NAME);
  _upsertMeta('name', 'twitter:description', description);
  if (ogImg) _upsertMeta('name', 'twitter:image', ogImg);
  else _removeMeta('name', 'twitter:image');

  // JSON-LD — wipe prior and inject fresh. data-k flag marks our scripts
  // so we never touch any JSON-LD a developer placed by hand.
  document.querySelectorAll('script[type="application/ld+json"][data-k="1"]').forEach(s => s.remove());
  if (jsonLd) {
    const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    arr.forEach((schema) => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.setAttribute('data-k', '1');
      s.textContent = JSON.stringify(schema);
      document.head.appendChild(s);
    });
  }
}
window.setMeta = setMeta;

// Convenience: site-wide Organization + WebSite schemas. Call once
// from any page (homepage uses it). The schemas are siteName-keyed
// so duplicates from multiple pages are harmless.
function siteJsonLd() {
  const origin = location.origin;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: origin,
      logo: `${origin}/assets/logo-wordmark.png`,
      description: SITE_DESCRIPTION,
      sameAs: [
        'https://twitter.com/karo_startup',
        'https://www.linkedin.com/company/karo-startup',
        'https://www.youtube.com/@karostartup',
        'https://www.instagram.com/karo_startup_',
        'https://www.facebook.com/karostartup'
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: origin,
      description: SITE_DESCRIPTION,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${origin}/search.html?q={search_term_string}` },
        'query-input': 'required name=search_term_string'
      }
    }
  ];
}
window.siteJsonLd = siteJsonLd;

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

function _tickerValueString(v) {
  // Auto-decide formatting: FX/commodity vs index.
  if (v == null) return '—';
  const n = Number(v);
  if (Math.abs(n) < 100) return n.toFixed(2);
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
function _tickerChangeHtml(t) {
  const dir = (t.change_percent || 0) >= 0 ? 'up' : 'down';
  const arrow = dir === 'up' ? '▲' : '▼';
  const sign = (t.change_value || 0) >= 0 ? '+' : '';
  const chgVal = Number(t.change_value || 0);
  const chgValStr = Math.abs(chgVal) < 100 ? chgVal.toFixed(2) : chgVal.toFixed(0);
  return `<span class="chg ${dir}"><span class="arrow">${arrow}</span> ${sign}${chgValStr} (${Math.abs(t.change_percent || 0).toFixed(2)}%)</span>`;
}

function renderTicker(tickers) {
  if (!tickers || !tickers.length) return '';
  const items = tickers.map(t => `
    <span class="ticker-item" data-symbol="${escapeAttr(t.symbol)}">
      <span class="sym">${escapeHtml(t.display_name || t.symbol)}</span>
      <span class="val">${_tickerValueString(t.value)}</span>
      ${_tickerChangeHtml(t)}
    </span>`).join('');
  return `
  <div class="ticker-bar">
    <div class="ticker-track">${items}${items}</div>
  </div>`;
}

// Update existing ticker DOM in place without breaking the CSS scroll animation.
// Called on an interval so values refresh whenever the cron job writes new ones.
async function refreshTickers() {
  try {
    const { data } = await sb.from('market_tickers').select('*').order('order_index', { ascending: true });
    if (!data || !data.length) return;
    _cacheSet('tickers', data);
    for (const t of data) {
      const items = document.querySelectorAll(`.ticker-item[data-symbol="${CSS.escape ? CSS.escape(t.symbol) : t.symbol.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}"]`);
      items.forEach((el) => {
        const sym = el.querySelector('.sym');
        const val = el.querySelector('.val');
        const oldChg = el.querySelector('.chg');
        if (sym) sym.textContent = t.display_name || t.symbol;
        if (val) val.textContent = _tickerValueString(t.value);
        if (oldChg) oldChg.outerHTML = _tickerChangeHtml(t);
      });
    }
  } catch {}
}
window.refreshTickers = refreshTickers;

function renderBreakingFromData(data) {
  if (!data || !data.length) return '';
  const sep = '<span class="sep">•</span>';
  const headlines = data.map(a => `<a href="/article/view.html?slug=${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a>`).join(sep);
  // Render twice so the scroll loops seamlessly (translateX 0 → -50%).
  const loop = `${headlines}${sep}${headlines}${sep}`;
  return `
  <div class="breaking-ribbon">
    <div class="container">
      <span class="breaking-pill">Breaking</span>
      <div class="breaking-mask">
        <div class="breaking-track">${loop}</div>
      </div>
    </div>
  </div>`;
}

function renderMasthead() {
  return `
  <div class="masthead">
    <div class="container">
      <div class="masthead-left">
        <button class="nav-mobile-btn" id="nav-burger" aria-label="Open menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <a href="/newsletters.html" class="masthead-link">Newsletters</a>
        <a href="/contact.html" class="masthead-link">Contact</a>
      </div>
      <a href="/" class="logo" aria-label="Karostartup home"><img src="/assets/logo-wordmark.png" alt="Karostartup"></a>
      <div class="masthead-right">
        <a href="/plus.html" class="plus-link">Plus</a>
        <button class="search-btn" id="search-trigger" type="button" aria-label="Search">${ICON.search} <span>Search</span></button>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   SEARCH OVERLAY — opens from the masthead search button.
   Inline input → routes to /search.html on submit. Escape / scrim
   click closes. Built once per page-load by mountChrome.
   ============================================================ */
function mountSearchOverlay() {
  if (document.getElementById('k-search-overlay')) return;
  const o = document.createElement('div');
  o.id = 'k-search-overlay';
  o.className = 'k-search-overlay';
  o.innerHTML = `
    <div class="k-search-card" role="dialog" aria-label="Site search">
      <button class="k-search-close" id="k-search-close" aria-label="Close">×</button>
      <span class="kicker" style="color:#d10a11;">Search</span>
      <h2 style="font-family:var(--font-display);font-weight:700;font-size:clamp(1.6rem,2.4vw,2.2rem);margin:8px 0 14px;">Find a story, a founder, a deal.</h2>
      <form class="k-search-form" id="k-search-form" role="search">
        <input type="search" id="k-search-input" placeholder="Try &quot;razorpay&quot;, &quot;series c&quot;, &quot;saas&quot;…" autocomplete="off" required>
        <button type="submit" class="btn btn-red">Search</button>
      </form>
      <div class="k-search-results" id="k-search-results" aria-live="polite"></div>
      <p class="k-search-foot">Press <kbd>Esc</kbd> to close · <kbd>Enter</kbd> for all results</p>
    </div>`;
  document.body.appendChild(o);

  const input = o.querySelector('#k-search-input');
  const resultsEl = o.querySelector('#k-search-results');

  const close = () => {
    o.classList.remove('is-open');
    document.body.style.overflow = '';
  };
  o.querySelector('#k-search-close').addEventListener('click', close);
  o.addEventListener('click', (e) => { if (e.target === o) close(); });
  o.querySelector('#k-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    location.href = '/search.html?q=' + encodeURIComponent(q);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && o.classList.contains('is-open')) close();
  });

  // Live search — debounced, cancellable
  let searchToken = 0;
  let debounceTimer = null;

  const highlight = (text, q) => {
    const safe = escapeHtml(text || '');
    if (!q) return safe;
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return safe.replace(re, '<mark>$1</mark>');
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  const renderResults = (q, articles, categories) => {
    if (!q) { resultsEl.innerHTML = ''; resultsEl.classList.remove('has-results'); return; }

    const catBlock = (categories && categories.length) ? `
      <div class="k-sr-section">
        <div class="k-sr-label">Sections</div>
        ${categories.map(c => `
          <a class="k-sr-cat" href="/category/view.html?slug=${encodeURIComponent(c.slug)}">
            <span class="k-sr-cat-dot" style="background:${escapeAttr(c.color || '#0a0a0a')};"></span>
            <span>${highlight(c.name, q)}</span>
          </a>`).join('')}
      </div>` : '';

    const artBlock = (articles && articles.length) ? `
      <div class="k-sr-section">
        <div class="k-sr-label">Stories</div>
        ${articles.map(a => `
          <a class="k-sr-item" href="/article/view.html?slug=${encodeURIComponent(a.slug)}">
            ${a.cover_image_url
              ? `<div class="k-sr-thumb"><img src="${escapeAttr(a.cover_image_url)}" alt="" loading="lazy"></div>`
              : `<div class="k-sr-thumb k-sr-thumb-empty"></div>`}
            <div class="k-sr-body">
              <div class="k-sr-meta">
                ${a.categories?.name ? `<span class="k-sr-cat-tag">${escapeHtml(a.categories.name)}</span>` : ''}
                <span class="k-sr-date">${fmtDate(a.published_at)}</span>
              </div>
              <div class="k-sr-title">${highlight(a.title, q)}</div>
              ${a.summary ? `<div class="k-sr-summary">${highlight(a.summary.slice(0, 140), q)}${a.summary.length > 140 ? '…' : ''}</div>` : ''}
            </div>
          </a>`).join('')}
      </div>` : '';

    if (!catBlock && !artBlock) {
      resultsEl.innerHTML = `<div class="k-sr-empty">No matches for "<strong>${escapeHtml(q)}</strong>" yet. Press Enter to search the archive.</div>`;
    } else {
      resultsEl.innerHTML = catBlock + artBlock + `
        <a class="k-sr-all" href="/search.html?q=${encodeURIComponent(q)}">See all results for "${escapeHtml(q)}" →</a>`;
    }
    resultsEl.classList.add('has-results');
  };

  const runSearch = async (q) => {
    const my = ++searchToken;
    if (!q) { renderResults('', [], []); return; }
    resultsEl.innerHTML = '<div class="k-sr-loading">Searching…</div>';
    resultsEl.classList.add('has-results');

    const safe = q.replace(/[%_,()]/g, ' ').trim();
    if (!safe) return;

    try {
      const [artRes, catRes] = await Promise.all([
        sb.from('articles')
          .select('id,slug,title,summary,cover_image_url,published_at,categories(name)')
          .eq('status', 'published')
          .or(`title.ilike.%${safe}%,summary.ilike.%${safe}%`)
          .order('published_at', { ascending: false })
          .limit(6),
        sb.from('categories')
          .select('slug,name,color')
          .ilike('name', `%${safe}%`)
          .limit(4)
      ]);
      if (my !== searchToken) return; // stale
      renderResults(q, artRes.data || [], catRes.data || []);
    } catch (e) {
      if (my !== searchToken) return;
      resultsEl.innerHTML = '<div class="k-sr-empty">Search failed. Please try again.</div>';
    }
  };

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(debounceTimer);
    if (!q) { searchToken++; renderResults('', [], []); return; }
    debounceTimer = setTimeout(() => runSearch(q), 180);
  });

  // Hook the masthead trigger
  const trigger = document.getElementById('search-trigger');
  if (trigger) trigger.addEventListener('click', () => {
    o.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input.focus(), 60);
  });
}

function renderNavFromData(categories, activeSlug = '') {
  // All categories render inline. After mount, _balanceNav() measures
  // the row width and moves overflowing items into the More dropdown.
  // If everything fits, the More button stays hidden.
  const cats = categories || [];
  const link = (c) => `<a href="/category/view.html?slug=${encodeURIComponent(c.slug)}" data-cat="1" ${c.slug === activeSlug ? 'class="is-active"' : ''}>${escapeHtml(c.name)}</a>`;
  const linksHtml = cats.map(link).join('');

  return `
  <nav class="nav">
    <div class="container">
      <div class="nav-links" id="k-nav-links">
        <a href="/" data-home="1" ${activeSlug === '' ? 'class="is-active"' : ''}>Home</a>
        ${linksHtml}
        <div class="k-nav-more" id="k-nav-more" hidden>
          <button class="k-nav-more-btn" id="k-nav-more-btn" type="button" aria-haspopup="true" aria-expanded="false">More <span class="k-nav-more-caret" aria-hidden="true">▾</span></button>
          <div class="k-nav-more-panel" id="k-nav-more-panel" role="menu"></div>
        </div>
      </div>
      <a href="/contact.html?type=promotion" class="nav-promote">Promote with us →</a>
    </div>
  </nav>`;
}

// Measure the nav row and move overflowing category items into the
// "More" dropdown. If everything fits, the dropdown stays hidden.
// Re-runs on resize.
function _balanceNav() {
  const navLinks = document.getElementById('k-nav-links');
  const moreEl = document.getElementById('k-nav-more');
  const morePanel = document.getElementById('k-nav-more-panel');
  if (!navLinks || !moreEl || !morePanel) return;

  // Step 1 — move any items previously stashed in the panel back into
  // the row, just before the More container. Then re-measure from scratch.
  const stashed = Array.from(morePanel.querySelectorAll('a'));
  stashed.forEach(a => navLinks.insertBefore(a, moreEl));
  morePanel.innerHTML = '';
  moreEl.hidden = true;
  moreEl.classList.remove('is-active');

  // Step 2 — overflow check. The Home link is anchored at the start and
  // never moves; category links carry data-cat="1" and are eligible to
  // shift into the dropdown.
  const isOverflowing = () => navLinks.scrollWidth > navLinks.clientWidth + 2;
  if (!isOverflowing()) return; // everything fits — keep More hidden

  // Step 3 — there's overflow, so reveal the More button…
  moreEl.hidden = false;

  // …then iterate from the rightmost category leftward, pulling items
  // out of the row and prepending them into the panel (so original
  // order is preserved inside the dropdown).
  while (isOverflowing()) {
    const items = navLinks.querySelectorAll('a[data-cat="1"]');
    if (items.length === 0) break; // safety: don't strip past the categories
    const last = items[items.length - 1];
    last.remove();
    morePanel.insertBefore(last, morePanel.firstChild);
  }

  // Step 4 — if the active category ended up in the panel, mark the
  // More button as active so the user can tell where they are.
  if (morePanel.querySelector('a.is-active')) moreEl.classList.add('is-active');
}

// Wire the "More ▾" dropdown. Toggles a panel, closes on outside click
// + Escape, and re-balances the nav on window resize.
function _wireNavMore() {
  // Run once after fonts are likely settled; once more after a short
  // delay so any late font shifts get accounted for.
  requestAnimationFrame(_balanceNav);
  setTimeout(_balanceNav, 600);

  const btn = document.getElementById('k-nav-more-btn');
  const panel = document.getElementById('k-nav-more-panel');
  if (btn && panel) {
    const close = () => { panel.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
    const toggle = () => {
      const isOpen = panel.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && e.target !== btn) close();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  // Rebalance on resize (debounced) — attach once globally.
  if (!window.__navResizeBound) {
    window.__navResizeBound = true;
    let t;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(_balanceNav, 150);
    });
  }
}

function renderFooter() {
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="logo"><img src="/assets/logo-wordmark.png" alt="Karostartup"></div>
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
            <li><a href="/internship.html">Internships</a></li>
            <li><a href="/contact.html?type=careers">Careers</a></li>
            <li><a href="/contact.html">Contact</a></li>
            <li><a href="/plus.html">Plus membership</a></li>
            <li><a href="/newsletters.html">Newsletters</a></li>
            <li><a href="/podcasts.html">Podcasts</a></li>
            <li><a href="/best-brands.html">Best Brands</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Reach Us</h4>
          <ul>
            <li><a href="/share-your-startup.html">Share your startup</a></li>
            <li><a href="/contact.html?type=advertise">Promote your startup</a></li>
            <li><a href="/contact.html?type=advertise">Advertise</a></li>
            <li><a href="/contact.html?type=tip">Send a tip</a></li>
            <li><a href="/contact.html?type=pr">PR / Press</a></li>
            <li><a href="/contact.html?type=partnership">Partnership</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Follow</h4>
          <div class="footer-socials">
            <a href="https://twitter.com/karo_startup" target="_blank" rel="noopener" aria-label="X (Twitter)" class="footer-social">${ICON.twitter}</a>
            <a href="https://www.linkedin.com/company/karo-startup" target="_blank" rel="noopener" aria-label="LinkedIn" class="footer-social">${ICON.linkedinSm}</a>
            <a href="https://www.youtube.com/@karostartup" target="_blank" rel="noopener" aria-label="YouTube" class="footer-social">${ICON.youtube}</a>
            <a href="https://www.instagram.com/karo_startup_" target="_blank" rel="noopener" aria-label="Instagram" class="footer-social">${ICON.instagram}</a>
            <a href="https://www.facebook.com/karostartup" target="_blank" rel="noopener" aria-label="Facebook" class="footer-social">${ICON.facebook}</a>
          </div>
          <p style="font-size:0.78rem;color:#9a9a9a;margin:16px 0 0;line-height:1.45;">Newsroom alerts:<br><a href="https://wa.me/919315194393" target="_blank" rel="noopener" style="color:#c5c5c5;">WhatsApp →</a></p>
        </div>
      </div>
      <div class="footer-bottom">
        <div>© ${new Date().getFullYear()} Karostartup. All rights reserved. <span class="footer-credit">Built and maintained by <a href="/neural-ai.html" rel="noopener">Neural AI</a>.</span></div>
        <div class="socials">
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms</a>
          <a href="/cookies.html">Cookies</a>
        </div>
      </div>
    </div>
  </footer>`;
}

/* ============================================================
   MOBILE DRAWER — slide-in panel triggered by the hamburger.
   Builds once per page load. Refreshes its category list when
   the chrome cache updates.
   ============================================================ */
function mountMobileDrawer(activeSlug, cats) {
  // Remove any prior drawer (mountChrome can be re-run).
  document.querySelectorAll('.k-drawer, .k-drawer-scrim').forEach(el => el.remove());

  const scrim = document.createElement('div');
  scrim.className = 'k-drawer-scrim';

  const drawer = document.createElement('aside');
  drawer.className = 'k-drawer';
  drawer.setAttribute('aria-label', 'Site menu');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML = `
    <div class="k-drawer-head">
      <a href="/" class="k-drawer-logo" aria-label="Karostartup home"><img src="/assets/logo-wordmark.png" alt="Karostartup"></a>
      <button class="k-drawer-close" id="k-drawer-close" aria-label="Close menu">×</button>
    </div>

    <form class="k-drawer-search" id="k-drawer-search" role="search">
      <span class="k-drawer-search-icon" aria-hidden="true">${ICON.search}</span>
      <input type="search" name="q" id="k-drawer-search-input" placeholder="Search Karostartup…" autocomplete="off" required>
    </form>

    <div class="k-drawer-section" id="k-drawer-auth"></div>

    <nav class="k-drawer-nav">
      <a href="/" class="k-drawer-link ${activeSlug === '' ? 'is-active' : ''}">Home</a>
      ${(cats || []).map(c => `<a href="/category/view.html?slug=${encodeURIComponent(c.slug)}" class="k-drawer-link ${c.slug === activeSlug ? 'is-active' : ''}">${escapeHtml(c.name)}</a>`).join('')}
    </nav>

    <div class="k-drawer-section">
      <h4>More</h4>
      <a href="/best-brands.html" class="k-drawer-link sub">Best Brands</a>
      <a href="/podcasts.html" class="k-drawer-link sub">Podcasts</a>
      <a href="/newsletters.html" class="k-drawer-link sub">Newsletters</a>
      <a href="/plus.html" class="k-drawer-link sub">Karostartup Plus</a>
      <a href="/share-your-startup.html" class="k-drawer-link sub">Share your startup</a>
      <a href="/internship.html" class="k-drawer-link sub">Internships</a>
      <a href="/contact.html" class="k-drawer-link sub">Contact</a>
    </div>

    <div class="k-drawer-section k-drawer-promote">
      <a href="/contact.html?type=promotion" class="btn btn-red btn-sm" style="width:100%;justify-content:center;">Promote your startup</a>
    </div>

    <div class="k-drawer-section k-drawer-follow">
      <h4>Follow Karostartup</h4>
      <div class="k-drawer-socials">
        <a href="https://twitter.com/karostartup" target="_blank" rel="noopener" aria-label="X (Twitter)">${ICON.twitter}</a>
        <a href="https://www.linkedin.com/company/karostartup" target="_blank" rel="noopener" aria-label="LinkedIn">${ICON.linkedinSm}</a>
        <a href="https://www.instagram.com/karostartup" target="_blank" rel="noopener" aria-label="Instagram">${ICON.instagram}</a>
        <a href="https://www.youtube.com/@karostartup" target="_blank" rel="noopener" aria-label="YouTube">${ICON.youtube}</a>
        <a href="https://www.facebook.com/karostartup" target="_blank" rel="noopener" aria-label="Facebook">${ICON.facebook}</a>
      </div>
    </div>`;

  document.body.appendChild(scrim);
  document.body.appendChild(drawer);

  const open = () => {
    drawer.classList.add('is-open');
    scrim.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const burger = document.getElementById('nav-burger');
    if (burger) burger.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    const burger = document.getElementById('nav-burger');
    if (burger) burger.setAttribute('aria-expanded', 'false');
  };

  const burger = document.getElementById('nav-burger');
  if (burger) burger.addEventListener('click', open);
  scrim.addEventListener('click', close);
  document.getElementById('k-drawer-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
  });

  // Search input → /search.html?q=...
  const searchForm = document.getElementById('k-drawer-search');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('k-drawer-search-input').value.trim();
      if (!q) return;
      location.href = '/search.html?q=' + encodeURIComponent(q);
    });
  }

  // Auth swap inside drawer — sits directly under the search input
  getCurrentSession().then((session) => {
    const slot = document.getElementById('k-drawer-auth');
    if (!slot) return;
    if (session?.user) {
      const profile = _cacheGet('profile:' + session.user.id, 120);
      const staffLink = profile && ['author', 'editor', 'admin'].includes(profile.role)
        ? `<a href="/admin/" class="k-drawer-link sub">Admin dashboard</a>` : '';
      slot.innerHTML = `
        <h4>Account</h4>
        ${staffLink}
        <a href="/profile.html" class="k-drawer-link sub">Your profile</a>
        <a href="#" class="k-drawer-link sub" id="k-drawer-signout">Sign out</a>`;
      const so = document.getElementById('k-drawer-signout');
      if (so) so.addEventListener('click', (e) => { e.preventDefault(); signOut(); });
    } else {
      slot.innerHTML = `
        <a href="/auth/signin.html" class="k-drawer-cta">Sign in</a>
        <a href="/auth/signup.html" class="k-drawer-link sub" style="text-align:center;">Create an account</a>`;
    }
  });
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

  // Hamburger drawer (mobile)
  mountMobileDrawer(activeSlug, cachedCats || []);
  // Search overlay (all viewports)
  mountSearchOverlay();
  // "More ▾" dropdown in desktop nav
  _wireNavMore();

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
    if (!cachedCats && cats.length && nav) {
      nav.outerHTML = renderNavFromData(cats, activeSlug);
      _wireNavMore();
    }

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

/* Media articles (podcast, video, interview) get a play-icon overlay
   on the cover image so readers can tell at a glance the story has
   embedded audio/video. Detected purely by kicker — cheap, no extra
   DB columns. */
const _MEDIA_KICKERS = new Set(['PODCAST', 'VIDEO', 'INTERVIEW', 'WATCH', 'LISTEN']);
function _isMediaArticle(a) {
  return !!(a && a.kicker && _MEDIA_KICKERS.has(String(a.kicker).toUpperCase()));
}
function _coverHtml(a, cover) {
  if (!cover) return '';
  const img = `<img src="${escapeAttr(cover)}" class="cover" alt="${escapeAttr(a.title)}" loading="lazy">`;
  if (!_isMediaArticle(a)) return img;
  return `<div class="cover-media">${img}<span class="media-play" aria-hidden="true"></span></div>`;
}
function _thumbHtml(a, cover, opts = {}) {
  if (!cover) return '';
  const cls = opts.className || 'thumb';
  const img = `<img src="${escapeAttr(cover)}" class="${cls}" alt="${escapeAttr(a.title)}" loading="lazy">`;
  if (!_isMediaArticle(a)) return img;
  return `<div class="thumb-media">${img}<span class="media-play media-play-sm" aria-hidden="true"></span></div>`;
}

// Returns the real cover URL for an article, or null when there isn't one.
// Site policy: never substitute a stock/SVG placeholder — callers should
// branch on null and skip the image element entirely.
function defaultCover(a) { return null; }
// Karostartup brand wordmark — used as the default author avatar so a
// byline never shows a generic "K." letter placeholder. The matching
// CSS rule (.is-default-avatar) flips object-fit to `contain` and adds
// a white background so the horizontal wordmark fits cleanly inside the
// circular avatar slot.
const DEFAULT_AUTHOR_AVATAR = '/assets/logo-wordmark.png';
function defaultAuthorAvatar() { return DEFAULT_AUTHOR_AVATAR; }

function renderStoryCard(a, opts = {}) {
  if (!a) return '';
  const cover = a.cover_image_url || defaultCover(a);
  const klass = opts.small ? 'story-card small' : 'story-card';
  const author = a.profiles?.full_name || a.author_name || '';
  const cat = a.categories?.name || '';
  return `
  <a href="${articleHref(a)}" class="${klass} reveal">
    ${_coverHtml(a, cover)}
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
    ${_thumbHtml(a, cover)}
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
    ${_thumbHtml(a, cover)}
  </a>`;
}

function renderLongreadCard(a) {
  if (!a) return '';
  const cover = a.cover_image_url || null;
  const isMedia = _isMediaArticle(a);
  return `
  <a href="${articleHref(a)}" class="longread-card${cover ? '' : ' longread-card-no-cover'} reveal">
    ${cover ? `<div class="cover-wrap${isMedia ? ' cover-wrap-media' : ''}"><img src="${escapeAttr(cover)}" class="cover" alt="${escapeAttr(a.title)}" loading="lazy">${isMedia ? '<span class="media-play" aria-hidden="true"></span>' : ''}</div>` : ''}
    <div class="longread-text">
      ${a.kicker ? `<span class="kicker">${escapeHtml(a.kicker)}</span>` : ''}
      <h3 class="title">${escapeHtml(a.title)}</h3>
      ${a.summary ? `<p class="summary">${escapeHtml(a.summary)}</p>` : ''}
    </div>
  </a>`;
}

function renderOpinionCard(a) {
  if (!a) return '';
  const author = a.profiles || {};
  const isDefault = !author.avatar_url;
  const avatar = author.avatar_url || DEFAULT_AUTHOR_AVATAR;
  return `
  <a href="${articleHref(a)}" class="opinion-card reveal">
    <div class="author-row">
      <img src="${escapeAttr(avatar)}" class="author-avatar${isDefault ? ' is-default-avatar' : ''}" alt="${escapeAttr(author.full_name || 'Karostartup')}">
      <div>
        <div class="author-name">${escapeHtml(author.full_name || 'Karostartup')}</div>
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
   COOKIE CONSENT BANNER
   ============================================================ */
const COOKIE_LS_KEY = 'k:cookie-consent';
function mountCookieBanner() {
  try {
    if (localStorage.getItem(COOKIE_LS_KEY)) return; // already responded
  } catch {}
  const el = document.createElement('div');
  el.className = 'cookie-banner';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Cookie consent');
  el.innerHTML = `
    <div class="cookie-msg">
      <strong>We use cookies.</strong> Karostartup uses essential cookies to keep you signed in and to remember your reading preferences. We also use lightweight analytics so we can write better stories. Read our <a href="/cookies.html">Cookie Policy</a> and <a href="/privacy.html">Privacy Policy</a>.
    </div>
    <div class="cookie-actions">
      <button class="btn btn-cookie-decline" type="button" data-cookie="decline">Essential only</button>
      <button class="btn btn-cookie-accept" type="button" data-cookie="accept">Accept all</button>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  el.querySelectorAll('[data-cookie]').forEach(btn => {
    btn.addEventListener('click', () => {
      try { localStorage.setItem(COOKIE_LS_KEY, btn.dataset.cookie); } catch {}
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 320);
    });
  });
}

/* ============================================================
   PAGE READY
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initReveal, 100);
  // Auto-refresh ticker values every 60s. The CSS animation keeps
  // running because we update the inner spans in place, not the
  // animated .ticker-track parent.
  setInterval(() => refreshTickers(), 60_000);
  // Show consent banner if user hasn't responded yet.
  setTimeout(mountCookieBanner, 600);
});

/* ============================================================
   EXPORTS (already on window)
   ============================================================ */
window.k = {
  sb, getCurrentUser, signInWithGoogle, getCurrentSession, getCurrentProfile, isStaff, isEditorOrAdmin, isAdmin,
  requireAuth, requireStaff, signOut,
  formatINR, formatUSD, formatNumber, timeAgo, formatDate, formatDateLong, formatTimeIST,
  slugify, escapeHtml, escapeAttr, renderMarkdown, showToast, initReveal,
  mountChrome, mountFooter, ICON,
  renderStoryCard, renderSideCard, renderStripItem, renderFeedItem, renderLongreadCard, renderOpinionCard,
  statusPill, typePill, roundPillClass, defaultCover, articleHref
};
