/* GET /api/auth/google/start?next=/somewhere
   Builds the Google consent URL and redirects. The handshake happens
   between this domain and Google directly — Supabase is not involved. */
const { getOrigin, safeNext, signToken, serializeCookie, randomHex } = require('../../_lib');

module.exports = async (req, res) => {
  const origin = getOrigin(req);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!clientId || !sessionSecret) {
    res.statusCode = 500;
    res.end('Google auth is not configured (missing GOOGLE_CLIENT_ID / SESSION_SECRET).');
    return;
  }

  const redirectUri = `${origin}/api/auth/google/callback`;

  let next = '/';
  try {
    const u = new URL(req.url, origin);
    next = safeNext(u.searchParams.get('next'));
  } catch { /* keep default */ }

  const state = randomHex(16);

  // Short-lived signed cookie binds this browser to the state+next (CSRF).
  // No nonce: we exchange the resulting Google id_token for a Supabase
  // session, and Supabase's id_token grant would reject a Google-echoed
  // (unhashed) nonce. State is sufficient CSRF protection here.
  const stateToken = signToken({ state, next }, sessionSecret, 600);
  res.setHeader('Set-Cookie', serializeCookie('ks_oauth', stateToken, {
    path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 600,
  }));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  res.statusCode = 302;
  res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.end();
};
