/* POST /api/admin/create-user   { email, role? }
   Admin-only. Creates a Supabase Auth user by email (service role), which
   auto-creates the profiles row via the handle_new_user trigger; optionally
   sets the role. Caller must present their Supabase access token (Bearer)
   and have profiles.role = 'admin'. */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2d3B2cW1xbWlzb2ZmYm5uamRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODYyNTEsImV4cCI6MjA5NDI2MjI1MX0.ZYBWcOGiVKV9HM3Ho2GjJ-r4XJvMITvsEK7vlEFlzVw';
const ROLES = ['reader', 'author', 'editor', 'admin'];

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!SERVICE_ROLE) return json(res, 500, { error: 'not_configured' });

  // 1. Caller's Supabase access token.
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json(res, 401, { error: 'no_token' });

  // 2. Resolve the caller from the token.
  let caller;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return json(res, 401, { error: 'invalid_token' });
    caller = await r.json();
  } catch {
    return json(res, 401, { error: 'invalid_token' });
  }

  // 3. Caller must be an admin (checked via service role, bypassing RLS).
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${caller.id}&select=role`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    const rows = await r.json();
    if (!Array.isArray(rows) || rows[0]?.role !== 'admin') return json(res, 403, { error: 'not_admin' });
  } catch {
    return json(res, 403, { error: 'not_admin' });
  }

  // 4. Body.
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let email, role;
  try {
    const b = JSON.parse(raw || '{}');
    email = String(b.email || '').trim().toLowerCase();
    role = ROLES.includes(b.role) ? b.role : null;
  } catch { return json(res, 400, { error: 'bad_body' }); }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: 'invalid_email' });

  // 5. Create the auth user (email pre-confirmed, no email sent).
  let newUser;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, email_confirm: true }),
    });
    newUser = await r.json();
    if (!r.ok) {
      return json(res, 400, { error: newUser.msg || newUser.error_description || newUser.message || 'create_failed' });
    }
  } catch {
    return json(res, 500, { error: 'create_error' });
  }

  // 6. Set role if requested (profile row was auto-created by the trigger).
  if (role && newUser.id) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${newUser.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ role }),
      });
    } catch { /* role can be set later in the UI */ }
  }

  return json(res, 200, { ok: true, id: newUser.id, email, role: role || 'reader' });
};
