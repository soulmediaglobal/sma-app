-- Issue #126 / PR #137 security hardening.
--
-- This Custom Access Token Hook keeps staff accounts OTP-only while allowing
-- ACTIVE client accounts to use Client Portal authentication methods. The hook
-- is inert until it is selected manually in Supabase Dashboard:
-- Authentication -> Hooks -> Custom Access Token Hook.

begin;

create function public.enforce_staff_otp_access_token(event jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  hook_user_id uuid;
  hook_authentication_method text;
  hook_claims jsonb;
  hook_amr jsonb;
  hook_profile_role text;
  hook_account_status text;
  hook_error constant jsonb := jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'Metode autentikasi tidak diizinkan.'
    )
  );
begin
  if jsonb_typeof(event) is distinct from 'object'
    or jsonb_typeof(event -> 'claims') is distinct from 'object'
    or jsonb_typeof(event -> 'user_id') is distinct from 'string'
    or jsonb_typeof(event -> 'authentication_method') is distinct from 'string'
  then
    return hook_error;
  end if;

  begin
    hook_user_id := (event ->> 'user_id')::uuid;
  exception
    when invalid_text_representation then
      return hook_error;
  end;

  hook_authentication_method := event ->> 'authentication_method';
  hook_claims := event -> 'claims';
  hook_amr := hook_claims -> 'amr';

  select profiles.role, profiles.account_status
  into hook_profile_role, hook_account_status
  from public.profiles
  where profiles.id = hook_user_id;

  if not found or hook_account_status is distinct from 'ACTIVE' then
    return hook_error;
  end if;

  if hook_profile_role = 'client' then
    return jsonb_build_object('claims', hook_claims);
  end if;

  if hook_profile_role not in ('admin', 'supervisor', 'internal') then
    return hook_error;
  end if;

  if hook_authentication_method = 'otp' then
    return jsonb_build_object('claims', hook_claims);
  end if;

  if hook_authentication_method = 'token_refresh' then
    if jsonb_typeof(hook_amr) is distinct from 'array' then
      return hook_error;
    end if;

    if jsonb_array_length(hook_amr) = 0
      or exists (
        select 1
        from jsonb_array_elements(hook_amr) as amr_entry(value)
        where jsonb_typeof(amr_entry.value) is distinct from 'object'
          or jsonb_typeof(amr_entry.value -> 'method') is distinct from 'string'
          or amr_entry.value ->> 'method' <> 'otp'
      )
    then
      return hook_error;
    end if;

    return jsonb_build_object('claims', hook_claims);
  end if;

  -- Staff password, recovery, OAuth, magic-link, invite, signup, and unknown
  -- authentication methods are deliberately rejected.
  return hook_error;
exception
  when others then
    -- Auth Hook responses must remain generic and fail closed. Database error
    -- details are intentionally not returned to the caller.
    return hook_error;
end;
$$;

revoke all on function public.enforce_staff_otp_access_token(jsonb)
from public, anon, authenticated;

grant usage on schema public to supabase_auth_admin;
grant select (id, role, account_status) on table public.profiles
to supabase_auth_admin;
grant execute on function public.enforce_staff_otp_access_token(jsonb)
to supabase_auth_admin;

create policy profiles_auth_hook_select
on public.profiles
for select
to supabase_auth_admin
using (true);

commit;
