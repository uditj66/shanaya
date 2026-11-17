-- Go-live hardening: serverless-safe rate limits, daily caps, idempotent tool calls, error events.

-- 1. Rate limits that work across serverless instances
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table public.rate_limits enable row level security; -- service role only

create function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit; -- true = allowed
end $$;
revoke execute on function public.hit_rate_limit from public, anon, authenticated;
grant execute on function public.hit_rate_limit to service_role;

-- 2. Daily caps per branch (protect Vapi / OpenAI credits)
alter table public.salons
  add column daily_web_voice_cap int not null default 100,
  add column daily_chat_cap int not null default 500;

-- 3. Idempotent tool calls (Vapi may retry)
create table public.tool_call_log (
  tool_call_id text primary key,
  salon_id uuid references public.salons(id) on delete cascade,
  tool text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.tool_call_log enable row level security; -- service role only

-- 4. Agent errors / events for the Health page
create table public.agent_events (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references public.salons(id) on delete cascade,
  kind text not null,          -- tool_error | webhook_auth | call_error | cap_reached
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.agent_events (salon_id, created_at desc);
alter table public.agent_events enable row level security;
create policy "members read events" on public.agent_events for select using (private.is_member(salon_id));
