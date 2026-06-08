-- Give `subscribers.email` a real uniqueness guarantee so the public sign-up dedupes
-- repeat addresses. The client does a plain INSERT (see cms.js sbSubscribe) — it can NOT
-- use an ON CONFLICT upsert, because that path needs the proposed row to be visible to the
-- caller and the `anon` role has no SELECT policy on this table (the list must not be
-- readable with the public key). With this index, a duplicate sign-up returns a unique
-- violation (HTTP 409), which the client treats as "already subscribed" = success.
--
-- Emails are normalized (trim + lowercase) on the client before insert, so a plain unique
-- index on `email` is enough. Existing rows are normalized + de-duplicated here (keeping
-- the earliest sign-up per address) so the index can be created. The index name matches the
-- one already present on the live project, so applying this to existing environments is a
-- no-op rather than creating a redundant second index.

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
create unique index if not exists subscribers_email_uniq
  on public.subscribers (email);
