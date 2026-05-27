/* POST /api/admin/delete-user   { id }
   Admin-only. Deletes a Supabase Auth user by id (service role); the
   profiles row is removed via ON DELETE CASCADE. Caller must present their
   Supabase access token (Bearer) and have profiles.role = 'admin'. You
   cannot delete your own account. */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2d3B2cW1xbWlzb2ZmYm5uamRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODYyNTEsImV4cCI6MjA5NDI2MjI1MX0.ZYBWcOGiVKV9HM3Ho2GjJ-r4XJvMITvsEK7vlEFlzVw';

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!SERVICE_ROLE) return json(res, 500, { error: 'not_configured' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json(res, 401, { error: 'no_token' });

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

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${caller.id}&select=role`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    const rows = await r.json();
    if (!Array.isArray(rows) || rows[0]?.role !== 'admin') return json(res, 403, { error: 'not_admin' });
  } catch {
    return json(res, 403, { error: 'not_admin' });
  }

  let id;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { id = String(JSON.parse(raw || '{}').id || '').trim(); } catch { return json(res, 400, { error: 'bad_body' }); }
  if (!id) return json(res, 400, { error: 'no_id' });
  if (id === caller.id) return json(res, 400, { error: 'cannot_delete_self' });

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return json(res, 400, { error: 'delete_failed', detail: t.slice(0, 120) });
    }
  } catch {
    return json(res, 500, { error: 'delete_error' });
  }

  return json(res, 200, { ok: true, id });
};
