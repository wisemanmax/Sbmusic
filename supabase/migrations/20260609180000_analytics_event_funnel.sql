-- Surface the semantic custom events (sbTrack: 'play', 'skip', 'rage', 'join',
-- 'vault_open', …) the public site now emits, plus a tiny session funnel, so the
-- admin dashboard shows engagement → conversion instead of only raw pageviews/clicks.
-- These ride on the existing type='event' rows (target = the event name), so no
-- schema change is needed — just a richer aggregate. Still SECURITY INVOKER and
-- service-role-only, so raw rows stay private (same boundary as before).
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
    'totals', jsonb_build_object(
      'events',    (select count(*) from ev),
      'pageviews', (select count(*) from pv),
      'visitors',  (select count(distinct visitor_id) from ev where visitor_id is not null),
      'sessions',  (select count(distinct session_id) from ev where session_id is not null),
      'clicks',    (select count(*) from ev where type = 'click'),
      'avg_seconds', (
        select round(avg((meta->>'seconds')::numeric))
        from ev where type = 'exit' and (meta->>'seconds') ~ '^[0-9.]+$'
      ),
      'avg_scroll', (
        select round(avg((meta->>'depth')::numeric))
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
    -- NEW: semantic custom events (sbTrack) grouped by name (target).
    'top_events', coalesce((
      select jsonb_agg(d order by (d->>'count')::int desc)
      from (
        select jsonb_build_object('target', target, 'count', count(*)) as d
        from ev where type = 'event' and target is not null and target <> ''
        group by target order by count(*) desc limit 25
      ) x
    ), '[]'::jsonb),
    -- NEW: session funnel — of the sessions in range, how many played a track and
    -- how many joined the list (distinct sessions, so each visit counts once).
    'funnel', jsonb_build_object(
      'sessions', (select count(distinct session_id) from ev where session_id is not null),
      'played',   (select count(distinct session_id) from ev where type = 'event' and target = 'play'  and session_id is not null),
      'joined',   (select count(distinct session_id) from ev where type = 'event' and target = 'join'  and session_id is not null)
    )
  );
$$;

revoke all on function public.analytics_summary(integer) from public;
revoke all on function public.analytics_summary(integer) from anon;
revoke all on function public.analytics_summary(integer) from authenticated;
grant execute on function public.analytics_summary(integer) to service_role;
