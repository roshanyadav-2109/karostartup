/* POST /api/ai/summarize   { title?, content }
   Staff-only. Generates a 1–2 sentence summary from article content using
   Google Gemini (free tier), keeping the API key server-side so it never
   reaches the browser. Caller must present their Supabase access token
   (Bearer) and have profiles.role in (author, editor, admin). */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://svwpvqmqmisoffbnnjdc.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2d3B2cW1xbWlzb2ZmYm5uamRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODYyNTEsImV4cCI6MjA5NDI2MjI1MX0.ZYBWcOGiVKV9HM3Ho2GjJ-r4XJvMITvsEK7vlEFlzVw';
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!GEMINI_KEY) return json(res, 500, { error: 'AI is not configured (missing GEMINI_API_KEY).' });

  // 1. Caller's Supabase access token.
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json(res, 401, { error: 'no_token' });

  // 2. Resolve caller from the token.
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

  // 3. Caller must be staff (checked via service role, bypassing RLS).
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${caller.id}&select=role`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    const rows = await r.json();
    const role = Array.isArray(rows) ? rows[0]?.role : null;
    if (!['author', 'editor', 'admin'].includes(role)) return json(res, 403, { error: 'not_staff' });
  } catch {
    return json(res, 403, { error: 'not_staff' });
  }

  // 4. Body.
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let title, content;
  try {
    const b = JSON.parse(raw || '{}');
    title = String(b.title || '').trim();
    content = String(b.content || '').replace(/\s+/g, ' ').trim();
  } catch { return json(res, 400, { error: 'bad_body' }); }
  if (content.length < 80) return json(res, 400, { error: 'Write the content first — there isn\'t enough text to summarize.' });

  // 5. Call Gemini.
  const prompt =
    `Summarize the article below for a business-news reader in 1–2 plain, neutral sentences (max ~45 words). ` +
    `State the concrete facts (who/what/figures). No preamble, no "this article", no markdown.\n\n` +
    `Headline: ${title}\n\nArticle:\n${content.slice(0, 8000)}`;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
        }),
      },
    );
    if (r.status === 429) return json(res, 429, { error: 'AI quota reached — try again later, or write the summary manually.' });
    if (!r.ok) {
      const txt = await r.text();
      return json(res, 502, { error: 'AI request failed.', detail: txt.slice(0, 200) });
    }
    const j = await r.json();
    let out = (j?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    out = out.replace(/^["'“]+|["'”]+$/g, '').replace(/\*\*/g, '').trim();
    if (!out) return json(res, 502, { error: 'AI returned an empty summary — try again.' });
    return json(res, 200, { ok: true, summary: out });
  } catch {
    return json(res, 500, { error: 'AI request error.' });
  }
};
