/* /api/auth/signout — clears the session cookie.
   Responds with JSON for fetch() callers, or 302 to "/" for direct nav. */
const { serializeCookie } = require('../_lib');

module.exports = async (req, res) => {
  res.setHeader('Set-Cookie', serializeCookie('ks_session', '', {
    path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 0,
  }));

  const accept = String(req.headers.accept || '');
  if (accept.includes('application/json')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.statusCode = 302;
  res.setHeader('Location', '/');
  res.end();
};
