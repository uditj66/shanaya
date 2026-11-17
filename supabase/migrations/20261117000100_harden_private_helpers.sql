-- Keep RLS helper functions out of the public REST API.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;
alter function public.is_member(uuid) set schema private;
alter function public.is_admin(uuid) set schema private;
alter function private.is_member(uuid) set search_path = public;
alter function private.is_admin(uuid) set search_path = public;
alter extension btree_gist set schema extensions;
