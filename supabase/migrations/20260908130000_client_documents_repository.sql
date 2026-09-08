-- Issue #228 — Document Repository, fondasi (bucket, tabel, kolom link)

begin;

create table public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  mime_type text not null
    check (mime_type in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png'
    )),
  file_size_bytes bigint not null
    check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index client_documents_client_id_idx
  on public.client_documents(client_id);

alter table public.client_documents enable row level security;

create policy client_documents_admin_all
  on public.client_documents
  using (auth_role() = 'admin')
  with check (auth_role() = 'admin');

create policy client_documents_internal_select
  on public.client_documents
  for select
  using (auth_role() = 'internal');

create policy client_documents_internal_insert
  on public.client_documents
  for insert
  with check (auth_role() = 'internal');

create policy client_documents_supervisor_select
  on public.client_documents
  for select
  using (auth_role() = 'supervisor');

alter table public.documents
  add column client_document_id uuid references public.client_documents(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from storage.buckets
    where id = 'client-documents'
       or name = 'client-documents'
  ) then
    raise exception 'Storage bucket client-documents sudah ada; konfigurasi existing tidak ditimpa';
  end if;
end;
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'client-documents',
  'client-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]::text[]
);

commit;
