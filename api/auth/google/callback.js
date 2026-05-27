/* GET /api/auth/google/callback?code=...&state=...
   Our domain does the Google handshake (code exchange with the client
   secret), then trades the Google id_token for a real SUPABASE Auth
   session via the id_token grant. That creates/links the auth.users row
   (→ profiles via trigger), so profiles.role / admin applies. The
   Supabase session is handed to the browser by the finish page. */
const {
  getOrigin, safeNext, verifyToken, decodeJwtPayload, parseCookies, serializeCookie,
} = require('../../_lib');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://svwpvqmqmisoffbnnjdc.supabase.co';
// Public anon key (same one shipped in the browser) — used only as the apikey
// header for the id_token grant call.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2d3B2cW1xbWlzb2ZmYm5uamRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODYyNTEsImV4cCI6MjA5NDI2MjI1MX0.ZYBWcOGiVKV9HM3Ho2GjJ-r4XJvMITvsEK7vlEFlzVw';

module.exports = async (req, res) => {
  const origin = getOrigin(req);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  const redirectUri = `${origin}/api/auth/google/callback`;

  function fail(reason) {
    res.statusCode = 302;
    res.setHeader('Set-Cookie', serializeCookie('ks_oauth', '', { path: '/', maxAge: 0 }));
    res.setHeader('Location', `/auth/signin.html?error=${encodeURIComponent(reason)}`);
    res.end();
  }

  if (!clientId || !clientSecret || !sessionSecret) {
    res.statusCode = 500;
    res.end('Google auth is not configured.');
    return;
  }

  const url = new URL(req.url, origin);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  if (oauthError) return fail(oauthError);
  if (!code || !state) return fail('missing_code');

  const cookies = parseCookies(req);
  const stateData = verifyToken(cookies.ks_oauth, sessionSecret);
  if (!stateData || stateData.state !== state) return fail('bad_state');

  // 1. Our domain ↔ Google: exchange the authorization code for tokens.
  let tokenJson;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    tokenJson = await r.json().catch(() => null);
    if (!r.ok || !tokenJson || !tokenJson.id_token) return fail('token_exchange_failed');
  } catch {
    return fail('token_exchange_error');
  }

  const claims = decodeJwtPayload(tokenJson.id_token);
  if (!claims || !claims.email) return fail('no_email');
  if (claims.aud !== clientId) return fail('aud_mismatch');

  // 2. Trade the Google id_token for a Supabase Auth session (server-side).
  //    Creates the auth.users row on first login → handle_new_user makes the
  //    profiles row → profiles.role governs admin/staff access.
  let sbSession;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', id_token: tokenJson.id_token }),
    });
    sbSession = await r.json().catch(() => null);
    if (!r.ok || !sbSession || !sbSession.access_token || !sbSession.refresh_token) {
      return fail('supabase_signin_failed');
    }
  } catch {
    return fail('supabase_signin_error');
  }

  // 3. Hand the Supabase session to the browser via the finish page.
  //    Tokens go in the URL fragment (#…), which is never sent to a server.
  const next = safeNext(stateData.next);
  const hash = new URLSearchParams({
    access_token: sbSession.access_token,
    refresh_token: sbSession.refresh_token,
    expires_in: String(sbSession.expires_in || 3600),
    token_type: 'bearer',
  }).toString();

  res.setHeader('Set-Cookie', serializeCookie('ks_oauth', '', { path: '/', maxAge: 0 }));
  res.statusCode = 302;
  res.setHeader('Location', `/auth/finish.html?next=${encodeURIComponent(next)}#${hash}`);
  res.end();
};
