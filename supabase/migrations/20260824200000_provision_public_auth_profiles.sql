-- Issue #83 — provisioning profile untuk public signup Client Portal.
--
-- role = 'client' menandai akun eksternal. client_id tetap NULL sampai
-- workflow aktivasi Issue #92 menghubungkannya ke client yang disetujui.

begin;

-- Kedua kolom ini sudah digunakan User Management pada environment existing,
-- tetapi migration pembentukannya pernah hilang dari Git. Rekam kembali schema
-- secara aman agar fresh database dan environment existing tetap kompatibel.
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists email text;

-- Ganti policy self-update dengan own-row + ACTIVE agar akun
-- SUSPENDED/DISABLED tidak dapat mengubah data profil sendiri. Policy untuk
-- role dengan hak lebih tinggi, bila tersedia, tidak diubah oleh Issue #83.
drop policy if exists profiles_self_update on public.profiles;

create policy profiles_self_update
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
  and account_status = 'ACTIVE'
)
with check (
  id = (select auth.uid())
  and account_status = 'ACTIVE'
);

revoke update (name, full_name, phone) on public.profiles from anon;
grant update (name, full_name, phone) on public.profiles to authenticated;

create function public.provision_public_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'Pengguna'
  );
begin
  insert into public.profiles (
    id,
    name,
    full_name,
    email,
    role,
    client_id,
    account_status
  )
  values (
    new.id,
    profile_name,
    profile_name,
    new.email,
    'client',
    null,
    'ACTIVE'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.provision_public_auth_profile() from public;

create trigger auth_users_provision_public_profile
after insert on auth.users
for each row
execute function public.provision_public_auth_profile();

commit;
