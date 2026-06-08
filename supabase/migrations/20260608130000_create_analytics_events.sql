-- Privacy-light, first-party analytics. The public site logs anonymous events
-- (pageviews, clicks, scroll depth, exit) with the publishable key; the admin
-- reads aggregates through the password-checked edge function (service role).
-- Same security model as `subscribers`: anon may INSERT, nobody may SELECT with
-- the public key — so raw events are never readable client-side.

create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  visitor_id  text,          -- anonymous id from localStorage (no PII)
  session_id  text,          -- per-session id (30-min idle window)
  type        text not null, -- 'pageview' | 'click' | 'scroll' | 'exit' | 'event'
  page        text,          -- pathname + query, e.g. /music.html
  target      text,          -- click label / custom event name
  referrer    text,          -- entry referrer host (first hit of a session)
  meta        jsonb          -- { title, seconds, depth, ... }
);
alter table public.analytics_events enable row level security;

-- anon may INSERT an event. There is deliberately NO select/update/delete policy,
-- so events can't be read with the public key — the admin reads aggregates through
-- analytics_summary() (service role, via the edge function). The CHECK both clears
-- the "RLS policy always true" advisory and bounds field sizes against abuse.
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
  );

create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_type_idx    on public.analytics_events (type);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id);

-- Aggregate the last p_days of events into a single JSON payload for the admin
-- dashboard. SECURITY INVOKER (default): only the service role calls it (via the
-- edge function) and the service role bypasses RLS, so the raw rows stay private.
-- search_path is pinned and EXECUTE is revoked from anon/authenticated below.
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
  -- a session's "exit" page = its last pageview (id breaks created_at ties so the
  -- result is deterministic even if two pageviews share a timestamp)
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
    ), '[]'::jsonb)
  );
$$;

-- Lock the function to the service role only — the public key must not be able to
-- call it (that's how raw events stay private; the public key can only INSERT).
revoke all on function public.analytics_summary(integer) from public;
revoke all on function public.analytics_summary(integer) from anon;
revoke all on function public.analytics_summary(integer) from authenticated;
grant execute on function public.analytics_summary(integer) to service_role;
