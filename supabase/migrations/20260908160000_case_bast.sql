-- Issue #238 — BAST (Berita Acara Serah Terima). 1 BAST per case,
-- final (tidak bisa dibuat ulang). completed_at dicatat tiap tahap
-- kerja selesai, dipakai untuk milestone BAST.

begin;

alter table public.case_work_stages
  add column completed_at timestamptz;

create table public.case_bast (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.cases(id) on delete cascade,
  bast_number text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.case_bast enable row level security;

create policy case_bast_admin_all
  on public.case_bast
  using (auth_role() = 'admin')
  with check (auth_role() = 'admin');

create policy case_bast_internal_all
  on public.case_bast
  using (auth_role() = 'internal')
  with check (auth_role() = 'internal');

create policy case_bast_supervisor_all
  on public.case_bast
  using (auth_role() = 'supervisor')
  with check (auth_role() = 'supervisor');

create or replace function public.generate_bast_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  case_num text;
begin
  select case_number into case_num from public.cases where id = new.case_id;
  if case_num is null then
    raise exception 'case_number tidak ditemukan untuk case_id %', new.case_id;
  end if;
  new.bast_number := case_num || '-BAST';
  return new;
end;
$$;

revoke all on function public.generate_bast_number() from public;

create trigger case_bast_generate_number
before insert on public.case_bast
for each row
execute function public.generate_bast_number();

commit;
