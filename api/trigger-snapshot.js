/* POST /api/trigger-snapshot
   Fires the Vercel Deploy Hook, which triggers a rebuild that regenerates
   data/homepage.json from current Supabase data (see vercel.json buildCommand
   + scripts/generate-homepage-snapshot.mjs). Called fire-and-forget by the
   admin after a publish / edit-of-live / unpublish / PIB push-live / auto-fetch
   toggle.

   The deploy-hook URL is kept SERVER-SIDE in env DEPLOY_HOOK_URL — never in the
   browser — so it can't be scraped from the page source. The caller must
   present a staff Supabase access token (Bearer); the worst case of a spurious
   authenticated call is a harmless rebuild (bounded by Vercel's 60/hr +
   100/day deploy caps). If DEPLOY_HOOK_URL is unset the endpoint is a safe
   no-op (the every-4h scheduled rebuild still refreshes the snapshot). */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2d3B2cW1xbWlzb2ZmYm5uamRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODYyNTEsImV4cCI6MjA5NDI2MjI1MX0.ZYBWcOGiVKV9HM3Ho2GjJ-r4XJvMITvsEK7vlEFlzVw';
const HOOK = process.env.DEPLOY_HOOK_URL;
const STAFF_ROLES = ['author', 'editor', 'admin'];

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  // Not configured yet -> safe no-op (don't 500; the scheduled rebuild covers it).
  if (!HOOK) return json(res, 200, { ok: false, skipped: 'no_hook_configured' });

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

  // 3. Caller must be staff. Prefer service role (bypasses RLS); else read the
  //    caller's own profile row with their token (allowed by RLS).
  try {
    const useService = !!SERVICE_ROLE;
    const headers = useService
      ? { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` }
      : { apikey: ANON, Authorization: `Bearer ${token}` };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${caller.id}&select=role`, { headers });
    const rows = await r.json();
    if (!Array.isArray(rows) || !STAFF_ROLES.includes(rows[0]?.role)) return json(res, 403, { error: 'not_staff' });
  } catch {
    return json(res, 403, { error: 'not_staff' });
  }

  // 4. Fire the deploy hook (server-side -> no CORS/preflight concerns).
  try {
    const r = await fetch(HOOK, { method: 'POST' });
    return json(res, 200, { ok: r.ok, status: r.status });
  } catch {
    return json(res, 502, { error: 'hook_failed' });
  }
};
