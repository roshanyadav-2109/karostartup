# Google Sign-In setup

Public visitors sign in with **Google**, handled by **Supabase Auth's Google
provider**. A Google login becomes a real Supabase user, so the existing
profile, bookmark, and newsletter features (all keyed to the Supabase auth user)
work unchanged. Staff/admin continue to use the same Supabase Auth.

## Already done (via the Supabase Management API)

- Google provider **enabled** in Authentication → Providers, with the client ID
  and secret stored in Supabase.
- `site_url` set to `https://karostartup.com`.
- `uri_allow_list` set to
  `https://karostartup.com/**,https://www.karostartup.com/**,http://localhost:3000/**`.
- Frontend wired up: `auth/signin.html` + `auth/signup.html` call
  `signInWithGoogle()` (→ `sb.auth.signInWithOAuth({ provider: 'google' })`).

## The one manual step left — Google Cloud Console

Supabase performs the OAuth callback, so Google must trust the Supabase
callback URL. In **APIs & Services → Credentials → your OAuth 2.0 Client ID**:

**Authorized redirect URIs** — add:
```
https://svwpvqmqmisoffbnnjdc.supabase.co/auth/v1/callback
```

**Authorized JavaScript origins** — add:
```
https://karostartup.com
https://www.karostartup.com
```

Also make sure the OAuth consent screen is configured/published (or your Google
account is listed as a test user while it's in "Testing" mode).

> ⚠️ **Rotate the Google client secret.** The secret you shared was exposed in
> chat. Reset it in Google Cloud Console, then update it in Supabase:
> Authentication → Providers → Google → Client Secret (or re-PATCH
> `external_google_secret` via the Management API).

## Flow

```
/auth/signin.html  "Continue with Google"
      │  sb.auth.signInWithOAuth({ provider: 'google' })
      ▼
Google consent  →  https://svwpvqmqmisoffbnnjdc.supabase.co/auth/v1/callback
      │            (Supabase mints the session)
      ▼
back to redirectTo (the page the user came from); the Supabase JS client
detects the session in the URL and stores it. getCurrentUser() now returns
the user; the email lives in auth.users.
```

No serverless functions, no extra env vars, no custom tables — Supabase owns
the whole handshake and stores the authenticated user/email in `auth.users`.
