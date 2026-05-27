/* GET /api/users/lookup?email=...  → { found, uid, email }
   Looks up a Supabase Auth (auth.users) user id by email, using the
   service role via the public.uid_by_email() SECURITY DEFINER function.
   Gated behind a valid ks_session cookie so it isn't a public
   email→uid enumerator. */
const { verifyToken, parseCookies, getOrigin } = require('../_lib');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const sessionSecret = process.env.SESSION_SECRET;
  const session = sessionSecret ? verifyToken(parseCookies(req).ks_session, sessionSecret) : null;
  if (!session) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'not_authenticated' }));
    return;
  }

  let email = '';
  try {
    email = (new URL(req.url, getOrigin(req)).searchParams.get('email') || '').trim();
  } catch { /* ignore */ }
  if (!email) {
    res.end(JSON.stringify({ found: false, uid: null, email: '' }));
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'not_configured' }));
    return;
  }

  try {
    const r = await fetch(`${url}/rest/v1/rpc/uid_by_email`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_email: email }),
    });
    if (!r.ok) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: 'lookup_failed' }));
      return;
    }
    const uid = await r.json(); // scalar uuid string, or null
    res.end(JSON.stringify({ found: !!uid, uid: uid || null, email }));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'lookup_error' }));
  }
};
