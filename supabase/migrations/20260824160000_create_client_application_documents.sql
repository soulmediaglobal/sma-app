-- Issue #104 — dokumen awal untuk client application sebelum case dibuat.
-- Policy metadata dan storage.objects sengaja ditunda ke Issue #82.

begin;

create table public.client_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.client_applications(id) on delete cascade,
  category text not null
    check (category in ('NIB', 'NPWP', 'IDENTITY', 'DEED', 'SUPPORTING', 'OTHER')),
  file_name text not null check (btrim(file_name) <> ''),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  mime_type text not null
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size_bytes bigint not null
    check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  uploaded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_application_documents_application_id_idx
  on public.client_application_documents(application_id);

create index client_application_documents_category_idx
  on public.client_application_documents(category);

create index client_application_documents_uploaded_by_profile_id_idx
  on public.client_application_documents(uploaded_by_profile_id);

alter table public.client_application_documents enable row level security;

create trigger client_application_documents_set_updated_at
before update on public.client_application_documents
for each row
execute function public.set_client_onboarding_updated_at();

do $$
begin
  if exists (
    select 1
    from storage.buckets
    where id = 'client-application-documents'
       or name = 'client-application-documents'
  ) then
    raise exception 'Storage bucket client-application-documents sudah ada; konfigurasi existing tidak ditimpa';
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
  'client-application-documents',
  'client-application-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
);

commit;
