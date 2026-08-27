-- Issue #126 — enforce satu akun Client Portal untuk satu client.

begin;

do $$
begin
  if exists (
    select 1
    from public.profiles
    where role = 'client'
      and client_id is not null
    group by client_id
    having count(*) > 1
  ) then
    raise exception using
      message = 'Tidak dapat membuat unique index: terdapat client_id yang terhubung ke lebih dari satu profile client.',
      hint = 'Selesaikan duplikasi profile client secara manual sebelum menjalankan migration ini.';
  end if;
end;
$$;

create unique index profiles_one_client_profile_per_client_idx
  on public.profiles (client_id)
  where role = 'client'
    and client_id is not null;

commit;
