-- Menutup celah self-role-escalation di tabel profiles.
--
-- Policy profiles_self_update cuma membatasi BARIS (auth.uid() = id),
-- tanpa membatasi KOLOM. Tanpa trigger ini, user non-admin secara
-- teknis bisa menjalankan:
--   update profiles set role = 'admin' where id = auth.uid();
-- dan lolos RLS.
--
-- Catatan: perubahan ini sudah dijalankan manual via psql (Session
-- Pooler) pada 2026-08-22 sebelum file ini dibuat. File ini
-- mendokumentasikan retroaktif + jadi acuan resmi untuk environment
-- lain (idempotent lewat `create or replace function`).

begin;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
as $$
begin
  if public.auth_role() <> 'admin'
     and (new.role is distinct from old.role
          or new.client_id is distinct from old.client_id)
  then
    raise exception 'Hanya admin yang boleh mengubah role atau client_id profil';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;

create trigger profiles_prevent_privilege_escalation
before update on public.profiles
for each row
execute function public.prevent_profile_privilege_escalation();

commit;
