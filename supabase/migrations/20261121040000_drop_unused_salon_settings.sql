-- Settings no longer stored per studio (apply AFTER deploying the code that stops reading/saving them):
--   llm_model: the website chat model is OPENAI_MODEL in the server environment, for every studio.
--   agent_greeting, phone_llm_model, voice_*: calls always use the saved Vapi assistant, where greeting,
--   model and voice are edited; the backup "build an assistant here" setup was removed.
alter table public.salons
  drop column if exists llm_model,
  drop column if exists agent_greeting,
  drop column if exists phone_llm_model,
  drop column if exists voice_provider,
  drop column if exists voice_id,
  drop column if exists voice_model,
  drop column if exists voice_settings;
