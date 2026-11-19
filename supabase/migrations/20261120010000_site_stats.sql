-- Website analytics summary for the dashboard. security invoker: row level security on site_events applies to the caller.
create or replace function public.site_stats(p_brand uuid, p_since timestamptz, p_tz text default 'Asia/Kolkata')
returns jsonb
language sql stable security invoker set search_path = public as $$
  with e as (
    select session_id, kind, path, detail, (created_at at time zone p_tz)::date as day
    from site_events where brand_id = p_brand and created_at >= p_since
  ),
  chatters as (select distinct session_id from e where kind in ('chat_open', 'chat_message')),
  bookers as (select distinct session_id from e where kind = 'booking_done' and detail->>'kind' = 'booked')
  select jsonb_build_object(
    'visitors', (select count(distinct session_id) from e),
    'views', (select count(*) from e where kind = 'page_view'),
    'daily', coalesce((select jsonb_agg(d order by d.day) from (
        select day, count(distinct session_id) as visitors, count(*) filter (where kind = 'page_view') as views from e group by day) d), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(p) from (
        select path, count(*) as views from e where kind = 'page_view' group by path order by views desc limit 8) p), '[]'::jsonb),
    'funnel', jsonb_build_array(
        (select count(distinct session_id) from e where kind = 'booking_step' and detail->>'step' = '1'),
        (select count(distinct session_id) from e where kind = 'booking_step' and detail->>'step' = '2'),
        (select count(distinct session_id) from e where kind = 'booking_step' and detail->>'step' = '3'),
        (select count(distinct session_id) from e where kind = 'booking_step' and detail->>'step' = '4'),
        (select count(*) from bookers)),
    'chat_sessions', (select count(*) from chatters),
    'chat_booked', (select count(*) from chatters c join bookers b using (session_id)),
    'booked_sessions', (select count(*) from bookers)
  );
$$;
revoke execute on function public.site_stats from public, anon;
grant execute on function public.site_stats to authenticated;
