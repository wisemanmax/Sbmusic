-- Surface the remaining consented dimensions in the admin dashboard. The tracker
-- already collects screen-size bucket, language, timezone and connection type and
-- sends them in each pageview's `meta` (see assets/analytics.js); migration
-- 20260608140000 added device/browser/os breakdowns but left these in meta. This
-- extends analytics_summary() to aggregate them too, so the admin can see locale /
-- region / screen / network make-up of the audience.
--
-- Still SECURITY INVOKER and service-role-only: raw rows stay private, the admin
-- only ever receives these aggregates through the password-checked edge function.

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
    -- remaining consented context, pulled from the pageview meta
    'languages', coalesce((
      select jsonb_agg(d order by (d->>'count')::int desc)
      from (
        select jsonb_build_object('language', meta->>'lang', 'count', count(*)) as d
        from pv where coalesce(meta->>'lang','') <> ''
        group by meta->>'lang' order by count(*) desc limit 15
      ) x
    ), '[]'::jsonb),
    'regions', coalesce((
      select jsonb_agg(d order by (d->>'count')::int desc)
      from (
        select jsonb_build_object('region', meta->>'tz', 'count', count(*)) as d
        from pv where coalesce(meta->>'tz','') <> ''
        group by meta->>'tz' order by count(*) desc limit 20
      ) x
    ), '[]'::jsonb),
    'screens', coalesce((
      select jsonb_agg(d order by (d->>'count')::int desc)
      from (
        select jsonb_build_object('screen', meta->>'screen', 'count', count(*)) as d
        from pv where coalesce(meta->>'screen','') <> ''
        group by meta->>'screen' order by count(*) desc
      ) x
    ), '[]'::jsonb),
    'connections', coalesce((
      select jsonb_agg(d order by (d->>'count')::int desc)
      from (
        select jsonb_build_object('connection', meta->>'conn', 'count', count(*)) as d
        from pv where coalesce(meta->>'conn','') <> ''
        group by meta->>'conn' order by count(*) desc
      ) x
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.analytics_summary(integer) from public;
revoke all on function public.analytics_summary(integer) from anon;
revoke all on function public.analytics_summary(integer) from authenticated;
grant execute on function public.analytics_summary(integer) to service_role;
