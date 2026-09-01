-- Hardening pass (site review, Sept 2026).
--
-- 1. analytics_summary(): every cast of attacker-writable jsonb text (meta->>'seconds',
--    'depth', 'lcp', 'cls', 'pct') now goes through num_safe(). The regex guards it used
--    ('^[0-9.]+$') still let '1.2.3' or '.' through — and '99999999999' passes '^[0-9]+$'
--    but overflows ::int — so a single anonymous INSERT with such a meta value made the
--    whole aggregate (and the admin Analytics tab) error for up to a year. Postgres also
--    doesn't promise to evaluate the guard before the cast.
-- 2. Seed site_content id=1. No migration ever inserted it; on a fresh database `save`
--    (an UPDATE matching 0 rows) reported success while publishing nothing. (admin_config
--    is NOT seeded: its password column is NOT NULL on the live database, and a placeholder
--    password would be a login — set that row by hand, see supabase/README.md.)
-- 3. Bound the anon INSERT policies a little further: subscribers.phone gets a length cap
--    (it had none), and analytics_events.meta must be a JSON object (or null).

-- ── 1. safe numeric cast ────────────────────────────────────────────────────────
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
  return r;
exception when others then
  return null;
end $$;
revoke all on function public.num_safe(text) from public;
revoke all on function public.num_safe(text) from anon;
revoke all on function public.num_safe(text) from authenticated;
grant execute on function public.num_safe(text) to service_role;

-- ── analytics_summary(): same aggregate as v4, with num_safe() on every meta cast ──
create or replace function public.analytics_summary(p_days integer default 30)
returns jsonb
language sql
stable
set search_path = public
as $$
  with span as (
    select greatest(1, least(coalesce(p_days, 30), 365)) as days
  ),
  ev as (
    select e.* from public.analytics_events e, span
    where e.created_at >= now() - make_interval(days => span.days)
  ),
  pv as (select * from ev where type = 'pageview'),
  last_pv as (
    select distinct on (session_id) session_id, page
    from pv
    where session_id is not null
    order by session_id, created_at desc, id desc
  )
  select jsonb_build_object(
    'days', (select days from span),
    'generated_at', now(),
    -- who is on the site RIGHT NOW (any event in the last 5 minutes; not span-bound)
    'live_now', (
      select count(distinct session_id) from public.analytics_events
      where created_at >= now() - interval '5 minutes' and session_id is not null
    ),
    'totals', jsonb_build_object(
      'events',    (select count(*) from ev),
      'pageviews', (select count(*) from pv),
      'visitors',  (select count(distinct visitor_id) from ev where visitor_id is not null),
      'sessions',  (select count(distinct session_id) from ev where session_id is not null),
      'clicks',    (select count(*) from ev where type = 'click'),
      -- new vs returning: a pageview carries meta.nv=1 the very first time a visitor id is minted
      'new_visitors', (select count(distinct visitor_id) from pv where (meta ? 'nv') and visitor_id is not null),
      'avg_seconds', (
        select round(avg(num_safe(meta->>'seconds')))
        from ev where type = 'exit' and (meta->>'seconds') ~ '^[0-9.]+$'
      ),
      'avg_scroll', (
        select round(avg(num_safe(meta->>'depth')))
        from ev where (meta ? 'depth') and (meta->>'depth') ~ '^[0-9.]+$'
      )
    ),
    'daily', coalesce((
      select jsonb_agg(d order by d->>'date')
      from (
        select jsonb_build_object(
          'date',     to_char(created_at, 'YYYY-MM-DD'),
          'views',    count(*) filter (where type = 'pageview'),
          'visitors', count(distinct visitor_id)
        ) as d
        from ev
        group by to_char(created_at, 'YYYY-MM-DD')
      ) x
    ), '[]'::jsonb),
    -- pageviews by hour of day (UTC) — when the audience is actually awake
    'hours', coalesce((
      select jsonb_agg(d order by (d->>'hour')::int)
      from (
        select jsonb_build_object('hour', extract(hour from created_at)::int,
                                  'views', count(*)) as d
        from pv group by extract(hour from created_at)::int
      ) x
    ), '[]'::jsonb),
    'top_pages', coalesce((
      select jsonb_agg(d order by (d->>'views')::int desc)
      from (
        select jsonb_build_object('page', page, 'views', count(*),
                                  'visitors', count(distinct visitor_id)) as d
        from pv where page is not null
        group by page order by count(*) desc limit 25
      ) x
    ), '[]'::jsonb),
    'top_clicks', coalesce((
      select jsonb_agg(d order by (d->>'clicks')::int desc)
      from (
        select jsonb_build_object('target', target, 'clicks', count(*)) as d
        from ev where type = 'click' and target is not null and target <> ''
        group by target order by count(*) desc limit 25
      ) x
    ), '[]'::jsonb),
    'exit_pages', coalesce((
      select jsonb_agg(d order by (d->>'exits')::int desc)
      from (
        select jsonb_build_object('page', page, 'exits', count(*)) as d
        from last_pv where page is not null
        group by page order by count(*) desc limit 25
      ) x
    ), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(d order by (d->>'count')::int desc)
      from (
        select jsonb_build_object('referrer', referrer, 'count', count(*)) as d
        from ev where referrer is not null and referrer <> ''
        group by referrer order by count(*) desc limit 20
      ) x
    ), '[]'::jsonb),
    -- first-touch campaign attribution (sessions, so a campaign visit counts once)
    'campaigns', coalesce((
      select jsonb_agg(d order by (d->>'sessions')::int desc)
      from (
        select jsonb_build_object(
          'source',   coalesce(meta->'utm'->>'source', '(ad click)'),
          'medium',   meta->'utm'->>'medium',
          'campaign', meta->'utm'->>'campaign',
          'sessions', count(distinct session_id)) as d
        from pv where (meta ? 'utm') and session_id is not null
        group by coalesce(meta->'utm'->>'source', '(ad click)'), meta->'utm'->>'medium', meta->'utm'->>'campaign'
        order by count(distinct session_id) desc limit 20
      ) x
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(d order by (d->>'count')::int desc)
      from (
        select jsonb_build_object('device', device, 'count', count(*)) as d
        from pv where device is not null and device <> ''
        group by device order by count(*) desc
      ) x
    ), '[]'::jsonb),
    'browsers', coalesce((
      select jsonb_agg(d order by (d->>'count')::int desc)
      from (
        select jsonb_build_object('browser', browser, 'count', count(*)) as d
        from pv where browser is not null and browser <> ''
        group by browser order by count(*) desc limit 15
      ) x
    ), '[]'::jsonb),
    'os', coalesce((
      select jsonb_agg(d order by (d->>'count')::int desc)
      from (
        select jsonb_build_object('os', os, 'count', count(*)) as d
        from pv where os is not null and os <> ''
        group by os order by count(*) desc limit 15
      ) x
    ), '[]'::jsonb),
    'top_events', coalesce((
      select jsonb_agg(d order by (d->>'count')::int desc)
      from (
        select jsonb_build_object('target', target, 'count', count(*)) as d
        from ev where type = 'event' and target is not null and target <> ''
        group by target order by count(*) desc limit 25
      ) x
    ), '[]'::jsonb),
    -- which songs actually get played, and how many plays reach 95% (a real full listen)
    'top_tracks', coalesce((
      select jsonb_agg(d order by (d->>'plays')::int desc)
      from (
        select jsonb_build_object(
          'track', coalesce(nullif(meta->>'track',''), '(unknown)'),
          'plays', count(*) filter (where target = 'play'),
          'full_listens', count(*) filter (where target = 'listen' and meta->>'pct' = '95')) as d
        from ev
        where type = 'event' and target in ('play','listen')
        group by coalesce(nullif(meta->>'track',''), '(unknown)')
        order by count(*) filter (where target = 'play') desc limit 15
      ) x
    ), '[]'::jsonb),
    -- where fans tap OUT to (streaming platforms / socials), by platform
    'outbound', coalesce((
      select jsonb_agg(d order by (d->>'clicks')::int desc)
      from (
        select jsonb_build_object(
          'platform', coalesce(nullif(meta->>'platform',''), 'other'),
          'clicks', count(*),
          'sessions', count(distinct session_id)) as d
        from ev where type = 'event' and target = 'outbound'
        group by coalesce(nullif(meta->>'platform',''), 'other')
        order by count(*) desc limit 12
      ) x
    ), '[]'::jsonb),
    -- real-user performance + breakage, sliceable by browser ("is Chrome lagging?")
    'perf', jsonb_build_object(
      'samples',   (select count(*) from ev where type = 'event' and target = 'web_vitals'),
      'avg_lcp',   (select round(avg(num_safe(meta->>'lcp'))) from ev
                    where type = 'event' and target = 'web_vitals' and (meta->>'lcp') ~ '^[0-9.]+$'),
      'p75_lcp',   (select round(percentile_cont(0.75) within group (order by num_safe(meta->>'lcp')))
                    from ev where type = 'event' and target = 'web_vitals' and (meta->>'lcp') ~ '^[0-9.]+$'),
      'avg_cls',   (select round(avg(num_safe(meta->>'cls')), 3) from ev
                    where type = 'event' and target = 'web_vitals' and (meta->>'cls') ~ '^[0-9.]+$'),
      'lite_pct',  (select round(100.0 * count(*) filter (where meta->>'lite' = '1') / greatest(count(*), 1))
                    from ev where type = 'event' and target = 'web_vitals'),
      'lite_flips',(select count(*) from ev where type = 'event' and target = 'perf_lite'),
      'js_errors', (select count(*) from ev where type = 'event' and target = 'js_error')
    ),
    'perf_by_browser', coalesce((
      select jsonb_agg(d order by (d->>'samples')::int desc)
      from (
        select jsonb_build_object(
          'browser', coalesce(nullif(browser,''), 'Other'),
          'samples', count(*),
          'avg_lcp', round(avg(num_safe(meta->>'lcp')) filter (where (meta->>'lcp') ~ '^[0-9.]+$')),
          'lite_pct', round(100.0 * count(*) filter (where meta->>'lite' = '1') / greatest(count(*), 1))) as d
        from ev where type = 'event' and target = 'web_vitals'
        group by coalesce(nullif(browser,''), 'Other')
        order by count(*) desc limit 8
      ) x
    ), '[]'::jsonb),
    'top_errors', coalesce((
      select jsonb_agg(d order by (d->>'count')::int desc)
      from (
        select jsonb_build_object('msg', left(coalesce(meta->>'msg','(no message)'), 120),
                                  'count', count(*)) as d
        from ev where type = 'event' and target = 'js_error'
        group by left(coalesce(meta->>'msg','(no message)'), 120)
        order by count(*) desc limit 8
      ) x
    ), '[]'::jsonb),
    -- session funnel: visited → played a track → got 50%+ through a song → joined the list
    'funnel', jsonb_build_object(
      'sessions', (select count(distinct session_id) from ev where session_id is not null),
      'played',   (select count(distinct session_id) from ev where type = 'event' and target = 'play' and session_id is not null),
      'listened', (select count(distinct session_id) from ev
                   where type = 'event' and target = 'listen'
                     and (meta->>'pct') ~ '^[0-9]+$' and num_safe(meta->>'pct') >= 50
                     and session_id is not null),
      'joined',   (select count(distinct session_id) from ev where type = 'event' and target = 'join' and session_id is not null)
    )
  );
$$;

revoke all on function public.analytics_summary(integer) from public;
revoke all on function public.analytics_summary(integer) from anon;
revoke all on function public.analytics_summary(integer) from authenticated;
grant execute on function public.analytics_summary(integer) to service_role;

-- ── 2. seed the content row (no-op where it already exists) ─────────────────────
insert into public.site_content (id) values (1) on conflict (id) do nothing;

-- ── 3. tighter anon INSERT bounds ──────────────────────────────────────────────
drop policy if exists "anon can subscribe" on public.subscribers;
create policy "anon can subscribe" on public.subscribers
  for insert to anon, authenticated
  with check (
    email is not null
    and char_length(email) between 5 and 320
    and position('@' in email) > 1
    and char_length(coalesce(phone, '')) <= 40      -- the site sends ≥10 bare digits
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
  );
