# Google Sign-In setup

Public visitors now sign in with **Google**. The OAuth handshake happens on
**our own domain** (Vercel serverless functions under `/api/auth/*`) — Supabase
is **not** the auth provider. After Google authenticates the user, the callback
stores their email in the Supabase `app_users` table and issues our own signed,
HttpOnly session cookie.

Staff still use the existing email/password Supabase Auth at `/admin`.

---

## 1. Create the Supabase table

Run `scripts/app-users-table.sql` in the Supabase SQL editor
(project `svwpvqmqmisoffbnnjdc`). RLS is enabled with **no policies**, so the
public anon key can't read it — only the service-role key (server-side) can.

## 2. Google Cloud Console

In **APIs & Services → Credentials → your OAuth 2.0 Client ID (Web application)**:

**Authorized JavaScript origins**
- `https://karostartup.com`
- `https://www.karostartup.com`

**Authorized redirect URIs**
- `https://karostartup.com/api/auth/google/callback`
- `https://www.karostartup.com/api/auth/google/callback`

(For local testing with `vercel dev`, also add `http://localhost:3000/api/auth/google/callback`.)

Make sure the OAuth consent screen is configured and published (or your Google
account is added as a test user while it's in "Testing").

## 3. Vercel environment variables

Add these in **Vercel → Project → Settings → Environment Variables**
(Production + Preview):

| Name | Value |
|------|-------|
| `GOOGLE_CLIENT_ID` | `937071415069-g8h948rg62l7270imies6q5h4ep6gfb2.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | *(your client secret — see warning below)* |
| `SESSION_SECRET` | `N4LsV4B9qyuey3nrpp287ZiYY4qZii9_Vu64DUNRPt1nv_F-zUyzLHSOoqr4m_SK` |
| `SUPABASE_URL` | `https://svwpvqmqmisoffbnnjdc.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(the same service-role key the cron workflows use)* |

`SESSION_SECRET` above was generated for you; rotate it any time (doing so logs
everyone out). It signs the session + OAuth-state cookies.

> ⚠️ **Rotate the Google client secret.** The secret you shared was exposed in
> chat. In Google Cloud Console, reset the client secret and paste the new value
> into `GOOGLE_CLIENT_SECRET` on Vercel. The secret lives **only** in this env
> var — never in client-side code.

## 4. Deploy

`git push` → Vercel builds. The `/api/auth/*` files become serverless functions
automatically (zero npm dependencies — pure Node built-ins).

---

## How it flows

```
/auth/signin.html  "Continue with Google"
      │
      ▼
GET /api/auth/google/start      → sets signed state cookie, 302 → Google consent
      │
      ▼  (user approves)
GET /api/auth/google/callback   → exchanges code+secret for tokens (server-side),
                                   verifies id_token (aud + nonce), upserts the
                                   email into Supabase app_users (service role),
                                   sets HttpOnly ks_session cookie, 302 → next
      │
      ▼
GET /api/auth/me                → frontend reads who's signed in
POST /api/auth/signout          → clears the cookie
```

## Endpoints

| Route | Purpose |
|-------|---------|
| `GET /api/auth/google/start?next=/path` | Begin OAuth; `next` must be a same-site path |
| `GET /api/auth/google/callback` | Google redirects here; does the exchange + storage |
| `GET /api/auth/me` | `{ "user": { sub, email, name, picture } }` or `{ "user": null }` |
| `POST /api/auth/signout` | Clears `ks_session` |
