-- Issue #159 corrective migration: replace inherited authenticated table
-- privileges with the minimum set required by the existing RLS policies.

begin;

revoke all privileges on table public.service_type_dependencies from public;
revoke all privileges on table public.service_type_dependencies from anon;
revoke all privileges on table public.service_type_dependencies from authenticated;

grant select, insert, update, delete
  on table public.service_type_dependencies
  to authenticated;

commit;
