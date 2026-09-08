-- Issue #234 — Case Deliverables: Produk & Summary Tahapan, wajib
-- sebelum tahap kerja bisa ditandai Selesai.

begin;

create table public.case_deliverables (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  stage_id uuid not null references public.case_work_stages(id) on delete cascade,
  type text not null check (type in ('PRODUK', 'SUMMARY')),
  name text not null check (btrim(name) <> ''),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  mime_type text not null check (mime_type = 'application/pdf'),
  file_size_bytes bigint not null
    check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index case_deliverables_case_id_idx
  on public.case_deliverables(case_id);

create index case_deliverables_stage_id_idx
  on public.case_deliverables(stage_id);

alter table public.case_deliverables enable row level security;

create policy case_deliverables_admin_all
  on public.case_deliverables
  using (auth_role() = 'admin')
  with check (auth_role() = 'admin');

create policy case_deliverables_internal_all
  on public.case_deliverables
  using (auth_role() = 'internal')
  with check (auth_role() = 'internal');

create policy case_deliverables_supervisor_all
  on public.case_deliverables
  using (auth_role() = 'supervisor')
  with check (auth_role() = 'supervisor');

do $$
begin
  if exists (
    select 1
    from storage.buckets
    where id = 'case-deliverables'
       or name = 'case-deliverables'
  ) then
    raise exception 'Storage bucket case-deliverables sudah ada; konfigurasi existing tidak ditimpa';
  end if;
end;
$$;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'case-deliverables', 'case-deliverables', false, 10485760,
  array['application/pdf']::text[]
);

create policy case_deliverables_storage_admin_all
on storage.objects
for all
to authenticated
using (bucket_id = 'case-deliverables' and public.auth_role() = 'admin')
with check (bucket_id = 'case-deliverables' and public.auth_role() = 'admin');

create policy case_deliverables_storage_internal_all
on storage.objects
for all
to authenticated
using (bucket_id = 'case-deliverables' and public.auth_role() = 'internal')
with check (bucket_id = 'case-deliverables' and public.auth_role() = 'internal');

create policy case_deliverables_storage_supervisor_all
on storage.objects
for all
to authenticated
using (bucket_id = 'case-deliverables' and public.auth_role() = 'supervisor')
with check (bucket_id = 'case-deliverables' and public.auth_role() = 'supervisor');

commit;
