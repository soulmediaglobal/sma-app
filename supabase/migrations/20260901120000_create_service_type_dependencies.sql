-- Issue #159 — konfigurasi dependency antar jenis layanan.
-- Edge disimpan sebagai layanan utama -> layanan prasyarat. Otomasi case
-- (ON_HOLD, pembuatan case prasyarat, dan RAB) sengaja berada di issue lain.

begin;

create table public.service_type_dependencies (
  service_type text not null
    references public.service_type_codes(service_type)
    on update cascade
    on delete restrict,
  prerequisite_service_type text not null
    references public.service_type_codes(service_type)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default now(),
  primary key (service_type, prerequisite_service_type),
  constraint service_type_dependencies_no_self_dependency
    check (service_type <> prerequisite_service_type)
);

create index service_type_dependencies_prerequisite_service_type_idx
  on public.service_type_dependencies(prerequisite_service_type);

alter table public.service_type_dependencies enable row level security;

-- Semua caller aplikasi memakai database role authenticated. Grant ini hanya
-- memberi kemampuan teknis agar policy RLS admin dapat menjalankan mutasi;
-- supervisor/internal/client tetap dibatasi oleh policy di bawah.
revoke all privileges on table public.service_type_dependencies from public, anon;
grant select, insert, update, delete on table public.service_type_dependencies to authenticated;

create policy service_type_dependencies_admin_all
  on public.service_type_dependencies
  for all
  to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy service_type_dependencies_supervisor_select
  on public.service_type_dependencies
  for select
  to authenticated
  using (public.auth_role() = 'supervisor');

create policy service_type_dependencies_internal_select
  on public.service_type_dependencies
  for select
  to authenticated
  using (public.auth_role() = 'internal');

-- RLS policy memeriksa siapa yang boleh menulis edge. Trigger ini menjaga
-- integritas graph untuk semua jalur penulisan yang diizinkan, termasuk
-- request PostgREST langsung. Advisory lock tetap menserialisasi seluruh
-- perubahan graph selama transaksi supaya dua insert paralel tidak dapat
-- membentuk cycle silang.
create function public.prevent_service_type_dependency_cycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  creates_cycle boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.service_type_dependencies', 0)
  );

  if tg_op = 'UPDATE' then
    -- Hilangkan edge lama dari traversal: update edge dapat memutus cycle
    -- lama, jadi graph yang diuji harus merepresentasikan nilai sesudah update.
    with recursive dependency_path(service_type, prerequisite_service_type) as (
      select dependency.service_type, dependency.prerequisite_service_type
      from public.service_type_dependencies as dependency
      where dependency.service_type = new.prerequisite_service_type
        and (
          dependency.service_type <> old.service_type
          or dependency.prerequisite_service_type <> old.prerequisite_service_type
        )

      union

      select dependency.service_type, dependency.prerequisite_service_type
      from public.service_type_dependencies as dependency
      inner join dependency_path as path
        on dependency.service_type = path.prerequisite_service_type
      where dependency.service_type <> old.service_type
        or dependency.prerequisite_service_type <> old.prerequisite_service_type
    )
    select exists (
      select 1
      from dependency_path
      where prerequisite_service_type = new.service_type
    )
    into creates_cycle;
  else
    with recursive dependency_path(service_type, prerequisite_service_type) as (
      select dependency.service_type, dependency.prerequisite_service_type
      from public.service_type_dependencies as dependency
      where dependency.service_type = new.prerequisite_service_type

      union

      select dependency.service_type, dependency.prerequisite_service_type
      from public.service_type_dependencies as dependency
      inner join dependency_path as path
        on dependency.service_type = path.prerequisite_service_type
    )
    select exists (
      select 1
      from dependency_path
      where prerequisite_service_type = new.service_type
    )
    into creates_cycle;
  end if;

  if creates_cycle then
    raise exception using
      errcode = '23514',
      message = 'service type dependency would create a cycle';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_service_type_dependency_cycle() from public;

create trigger service_type_dependencies_prevent_cycle
before insert or update of service_type, prerequisite_service_type
on public.service_type_dependencies
for each row
execute function public.prevent_service_type_dependency_cycle();

commit;
