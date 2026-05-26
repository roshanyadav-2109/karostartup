/* GET /api/auth/google/callback?code=...&state=...
   Exchanges the code for tokens (using the client secret, server-side),
   verifies the id_token, stores the email in Supabase, then issues our
   own signed session cookie. */
const {
  getOrigin, safeNext, signToken, verifyToken, decodeJwtPayload,
  parseCookies, serializeCookie, upsertUser,
} = require('../../_lib');

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

  // Validate the state against the signed cookie set in /start.
  const cookies = parseCookies(req);
  const stateData = verifyToken(cookies.ks_oauth, sessionSecret);
  if (!stateData || stateData.state !== state) return fail('bad_state');

  // Exchange the authorization code for tokens (server-to-server, TLS).
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
    if (!r.ok || !tokenJson) return fail('token_exchange_failed');
  } catch {
    return fail('token_exchange_error');
  }

  const claims = decodeJwtPayload(tokenJson.id_token);
  if (!claims || !claims.email) return fail('no_email');
  if (claims.aud !== clientId) return fail('aud_mismatch');
  if (stateData.nonce && claims.nonce && claims.nonce !== stateData.nonce) return fail('nonce_mismatch');

  // Persist the authenticated user in Supabase (the only Supabase touchpoint).
  try {
    await upsertUser({
      sub: claims.sub,
      email: claims.email,
      email_verified: claims.email_verified,
      name: claims.name,
      picture: claims.picture,
    });
  } catch {
    return fail('store_failed');
  }

  // Issue our own 30-day session cookie.
  const session = signToken({
    sub: claims.sub,
    email: claims.email,
    name: claims.name || '',
    picture: claims.picture || '',
  }, sessionSecret, 60 * 60 * 24 * 30);

  res.setHeader('Set-Cookie', [
    serializeCookie('ks_session', session, {
      path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 60 * 60 * 24 * 30,
    }),
    serializeCookie('ks_oauth', '', { path: '/', maxAge: 0 }),
  ]);
  res.statusCode = 302;
  res.setHeader('Location', safeNext(stateData.next));
  res.end();
};
