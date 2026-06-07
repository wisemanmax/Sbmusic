-- Email / SMS sign-ups captured by the public "join the slime" form.

create table if not exists public.subscribers (
  id         bigint generated always as identity primary key,
  email      text,
  phone      text,
  created_at timestamptz not null default now()
);
alter table public.subscribers enable row level security;
-- anon may INSERT a sign-up. There is deliberately NO select/update/delete policy,
-- so the subscriber list cannot be read with the public key — the admin reads it
-- through the password-checked edge function (service role).
drop policy if exists "anon can subscribe" on public.subscribers;
create policy "anon can subscribe" on public.subscribers
  for insert to anon, authenticated with check (true);
