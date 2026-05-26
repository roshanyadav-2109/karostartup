/* ============================================================
   KAROSTARTUP — Serverless auth helpers (CommonJS, zero-deps)
   Used by /api/auth/* functions. Files prefixed with "_" are
   NOT routed by Vercel; they are bundled for import only.
   ============================================================ */
const crypto = require('crypto');

/* ---------- base64url ---------- */
function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}
function fromB64url(s) {
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/* ---------- HS256 signed tokens (our own session + oauth state) ---------- */
function hmac(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest();
}

function signToken(payload, secret, expSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson({ ...payload, iat: now, exp: now + expSeconds });
  const sig = b64url(hmac(`${head}.${body}`, secret));
  return `${head}.${body}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = b64url(hmac(`${head}.${body}`, secret));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let claims;
  try { claims = JSON.parse(fromB64url(body).toString('utf8')); } catch { return null; }
  if (claims.exp && Math.floor(Date.now() / 1000) > claims.exp) return null;
  return claims;
}

/* ---------- Decode a Google id_token (no signature check needed:
   we received it over a direct TLS call to Google's token endpoint) ---------- */
function decodeJwtPayload(jwt) {
  if (!jwt || typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try { return JSON.parse(fromB64url(parts[1]).toString('utf8')); } catch { return null; }
}

/* ---------- cookies ---------- */
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i < 0) return;
    const k = pair.slice(0, i).trim();
    const v = pair.slice(i + 1).trim();
    if (k) { try { out[k] = decodeURIComponent(v); } catch { out[k] = v; } }
  });
  return out;
}

function serializeCookie(name, value, opts = {}) {
  let s = `${name}=${encodeURIComponent(value)}`;
  if (opts.maxAge != null) s += `; Max-Age=${opts.maxAge}`;
  s += `; Path=${opts.path || '/'}`;
  if (opts.httpOnly) s += '; HttpOnly';
  if (opts.secure) s += '; Secure';
  if (opts.sameSite) s += `; SameSite=${opts.sameSite}`;
  return s;
}

/* ---------- request origin (works on apex, www, and previews) ---------- */
function getOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${proto}://${host}`;
}

/* ---------- only allow same-site relative redirects ---------- */
function safeNext(next) {
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/';
}

/* ---------- store the authenticated user in Supabase (service-role,
   bypasses RLS). Upsert on google_sub. ---------- */
async function upsertUser(claims) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase_env_missing');

  const row = {
    google_sub: claims.sub,
    email: claims.email,
    email_verified: !!claims.email_verified,
    name: claims.name || null,
    picture: claims.picture || null,
    last_login_at: new Date().toISOString(),
  };

  const res = await fetch(`${url}/rest/v1/app_users?on_conflict=google_sub`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`supabase_upsert_failed ${res.status} ${text}`);
  }
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? data[0] : data;
}

module.exports = {
  b64url, b64urlJson, fromB64url,
  signToken, verifyToken, decodeJwtPayload,
  parseCookies, serializeCookie,
  getOrigin, safeNext, upsertUser,
  randomHex: (n) => crypto.randomBytes(n).toString('hex'),
};
