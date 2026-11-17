-- Cost-efficient defaults available to the account's OpenAI project.
alter table public.salons alter column llm_model set default 'gpt-5.4-mini';
alter table public.salons alter column phone_llm_model set default 'gpt-4o-mini';
update public.salons set llm_model = 'gpt-5.4-mini' where llm_model = 'gpt-6-luna';
update public.salons set phone_llm_model = 'gpt-4o-mini' where phone_llm_model = 'gpt-4o';
