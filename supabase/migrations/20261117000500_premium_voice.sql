-- Premium, consistent voice for Shanaya (same config on phone and website).
alter table public.salons add column voice_model text;
alter table public.salons add column voice_settings jsonb not null default '{"speed": 1.0}'::jsonb;
alter table public.salons alter column voice_provider set default 'vapi';
alter table public.salons alter column voice_id set default 'Naina';
alter table public.salons alter column phone_llm_model set default 'gpt-4o';
update public.salons
   set voice_provider = 'vapi', voice_id = 'Naina', voice_model = null
 where voice_id is null or voice_provider = '11labs';
update public.salons set phone_llm_model = 'gpt-4o' where phone_llm_model = 'gpt-4o-mini';
