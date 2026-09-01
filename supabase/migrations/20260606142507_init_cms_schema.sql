-- Site content (single row) + admin password store. Reflects the deployed schema.

create table if not exists public.site_content (
  id         integer primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
-- the public site reads content with the publishable (anon) key;
-- all writes go through the admin edge function (service role).
drop policy if exists "public read content" on public.site_content;
create policy "public read content" on public.site_content
  for select to public using (true);

create table if not exists public.admin_config (
  id       integer primary key default 1 check (id = 1),
  password text not null   -- (matches the live database; set row 1 by hand, see README)
);
alter table public.admin_config enable row level security;
-- no policies on purpose: only the service role (admin edge function) can read/write it.
