-- Tighten the public sign-up INSERT from WITH CHECK (true) to require a plausible
-- email. The join form already validates client-side; this rejects obviously-bogus
-- inserts and clears the "RLS policy always true" advisory while keeping sign-ups open
-- to the public. The admin edge function uses the service role and bypasses RLS.
drop policy if exists "anon can subscribe" on public.subscribers;
create policy "anon can subscribe" on public.subscribers
  for insert to anon, authenticated
  with check (
    email is not null
    and char_length(email) between 5 and 320
    and position('@' in email) > 1
  );
