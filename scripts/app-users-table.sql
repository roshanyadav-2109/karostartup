-- ============================================================
-- app_users — visitors who signed in with Google.
-- The OAuth handshake happens on our own domain (Vercel functions);
-- Supabase is used ONLY as the data store. Writes happen exclusively
-- through the service-role key in /api/auth/google/callback.
--
-- Run this in the Supabase SQL editor (project svwpvqmqmisoffbnnjdc).
-- ============================================================

create table if not exists public.app_users (
  id             uuid primary key default gen_random_uuid(),
  google_sub     text unique not null,
  email          text not null,
  email_verified boolean default false,
  name           text,
  picture        text,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz not null default now()
);

create index if not exists app_users_email_idx on public.app_users (email);

-- Lock the table down. RLS is ON and there are NO policies, so the
-- public anon key (shipped in the browser) can neither read nor write.
-- The service-role key used by the serverless callback bypasses RLS.
alter table public.app_users enable row level security;

-- (Optional) revoke any default grants from anon/authenticated, belt-and-braces.
revoke all on public.app_users from anon, authenticated;
