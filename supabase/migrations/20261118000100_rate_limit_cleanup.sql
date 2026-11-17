-- Keep rate_limits small: about 1% of calls also delete windows older than 2 days.
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '2 days';
  end if;
  insert into rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit; -- true = allowed
end $$;
revoke execute on function public.hit_rate_limit from public, anon, authenticated;
grant execute on function public.hit_rate_limit to service_role;
