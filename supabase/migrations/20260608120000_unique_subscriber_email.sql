-- Give `subscribers.email` a real uniqueness guarantee so the public sign-up upsert
-- (POST ...?on_conflict=email with Prefer: resolution=ignore-duplicates) has a matching
-- conflict target. Without it PostgREST rejects the insert (SQLSTATE 42P10 — "no unique
-- or exclusion constraint matching the ON CONFLICT specification"), the client sees a
-- non-2xx response, and every sign-up silently falls into the offline retry queue
-- forever. See cms.js sbSubscribe().
--
-- Emails are normalized (trim + lowercase) on the client before insert, so a plain
-- unique index on `email` is enough and — unlike a unique index on lower(email) — it
-- actually matches `on_conflict=email`. Existing rows are normalized + de-duplicated
-- here (keeping the earliest sign-up per address) so the index can be created.

-- 1) normalize existing addresses in place
update public.subscribers
   set email = lower(btrim(email))
 where email is not null
   and email <> lower(btrim(email));

-- 2) drop duplicate addresses, keeping the earliest sign-up (lowest id)
delete from public.subscribers a
 using public.subscribers b
 where a.email is not null
   and a.email = b.email
   and a.id > b.id;

-- 3) enforce uniqueness. NULLs remain allowed/distinct, which is fine — the sign-up
--    policy already requires a non-null email.
create unique index if not exists subscribers_email_uidx
  on public.subscribers (email);
