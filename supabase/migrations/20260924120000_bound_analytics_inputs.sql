-- Close two ways a single anonymous INSERT could still wreck the admin Analytics tab.
--
-- 1. num_safe() caught malformed numbers but not huge ones. A ~310-digit meta value
--    (e.g. "lcp") passes the '^[0-9.]+$' guard, fits under the 8 KB meta cap and parses
--    as numeric — then percentile_cont() casts it to float8, overflows, and the whole
--    analytics_summary() call errors (the edge function returns 400). No real metric is
--    anywhere near 1e12, so treat anything past that as garbage.
--
-- 2. The anon INSERT policies never looked at created_at, and anon holds the default
--    column-level INSERT grant, so a row could be back- or future-dated. A row stamped
--    2099 sits inside every date range forever and shows as "on the site now" for good.
--    The site never sends created_at (the column default fills it), so require it to be
--    "now" and delete any future-dated rows already there.

-- ── 1. bounded safe numeric cast ─────────────────────────────────────────────────
create or replace function public.num_safe(t text)
returns numeric
language plpgsql
immutable
strict
parallel safe
set search_path = public
as $$
declare r numeric;
begin
  r := t::numeric;
  if r::text in ('NaN', 'Infinity', '-Infinity') then return null; end if;
  if abs(r) > 1e12 then return null; end if;   -- would overflow float8 in percentile_cont
  return r;
exception when others then
  return null;
end $$;
revoke all on function public.num_safe(text) from public;
revoke all on function public.num_safe(text) from anon;
revoke all on function public.num_safe(text) from authenticated;
grant execute on function public.num_safe(text) to service_role;

-- ── 2. created_at must be the server's "now" ─────────────────────────────────────
drop policy if exists "anon can subscribe" on public.subscribers;
create policy "anon can subscribe" on public.subscribers
  for insert to anon, authenticated
  with check (
    email is not null
    and char_length(email) between 5 and 320
    and position('@' in email) > 1
    and char_length(coalesce(phone, '')) <= 40      -- the site sends ≥10 bare digits
    and created_at between now() - interval '1 minute' and now() + interval '1 minute'
  );

drop policy if exists "anon can log events" on public.analytics_events;
create policy "anon can log events" on public.analytics_events
  for insert to anon, authenticated
  with check (
    type in ('pageview','click','scroll','exit','event')
    and char_length(coalesce(page,''))       <= 256
    and char_length(coalesce(target,''))      <= 300
    and char_length(coalesce(referrer,''))    <= 512
    and char_length(coalesce(visitor_id,''))  <= 64
    and char_length(coalesce(session_id,''))  <= 64
    and char_length(coalesce(device,''))      <= 16
    and char_length(coalesce(browser,''))     <= 32
    and char_length(coalesce(os,''))          <= 32
    and (meta is null or jsonb_typeof(meta) = 'object')
    and pg_column_size(coalesce(meta,'{}'::jsonb)) <= 8192
    and created_at between now() - interval '1 minute' and now() + interval '1 minute'
  );

-- anything dated in the future can only have been forged
delete from public.analytics_events where created_at > now() + interval '1 hour';
