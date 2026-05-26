/* GET /api/auth/me — returns the currently signed-in Google user (or null).
   Reads the signed HttpOnly session cookie; no Supabase call needed. */
const { verifyToken, parseCookies } = require('../_lib');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const sessionSecret = process.env.SESSION_SECRET;
  const cookies = parseCookies(req);
  const claims = sessionSecret ? verifyToken(cookies.ks_session, sessionSecret) : null;

  if (!claims) {
    res.end(JSON.stringify({ user: null }));
    return;
  }
  res.end(JSON.stringify({
    user: {
      sub: claims.sub,
      email: claims.email,
      name: claims.name || '',
      picture: claims.picture || '',
    },
  }));
};
