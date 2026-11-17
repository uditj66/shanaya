-- The AI receptionist is called Shanaya by default.
alter table public.salons alter column agent_name set default 'Shanaya';
update public.salons set agent_name = 'Shanaya' where agent_name = 'Aria';
