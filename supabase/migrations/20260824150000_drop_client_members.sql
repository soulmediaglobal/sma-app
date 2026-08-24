-- Issue #102 — profiles.client_id tetap menjadi sumber akses client.
-- client_members hanya boleh dihapus selama tabel belum berisi data.

begin;

lock table public.client_members in access exclusive mode;

do $$
begin
  if exists (select 1 from public.client_members) then
    raise exception 'public.client_members tidak kosong; migration dibatalkan agar data membership tidak hilang';
  end if;
end;
$$;

drop table public.client_members;

commit;
