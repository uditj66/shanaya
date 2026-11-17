-- Conversation state for website-widget chats (OpenAI previous_response_id, turn count).
alter table public.calls add column agent_state jsonb not null default '{}'::jsonb;
