-- Issue #81 — schema pendaftaran publik dan client membership.
-- Policy RLS sengaja ditunda ke Issue #82; kedua tabel default-deny.
-- Applicant wajib sudah memiliki row public.profiles sebelum membuat
-- client application. Provisioning auth/profile berada di luar Issue #81.

begin;

create table public.client_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_profile_id uuid not null references public.profiles(id) on delete restrict,
  applicant_type text not null
    check (applicant_type in ('INDIVIDUAL', 'BUSINESS')),
  entity_type text
    check (entity_type in ('PT', 'CV', 'YAYASAN', 'OTHER')),
  service_type text not null references public.service_type_codes(service_type)
    on update cascade on delete restrict,
  applicant_name text not null check (btrim(applicant_name) <> ''),
  business_name text,
  nib text check (nib is null or btrim(nib) <> ''),
  npwp text check (npwp is null or btrim(npwp) <> ''),
  pic_name text not null check (btrim(pic_name) <> ''),
  pic_email text not null check (btrim(pic_email) <> ''),
  whatsapp_number text not null check (btrim(whatsapp_number) <> ''),
  region text not null check (btrim(region) <> ''),
  needs_description text not null check (btrim(needs_description) <> ''),
  status text not null default 'DRAFT'
    check (status in (
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'REVISION_REQUIRED',
      'APPROVED',
      'REJECTED',
      'CANCELLED'
    )),
  applicant_visible_revision_notes text,
  internal_notes text,
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  revision_requested_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (
      applicant_type = 'BUSINESS'
      and entity_type is not null
      and nullif(btrim(business_name), '') is not null
    )
    or (
      applicant_type = 'INDIVIDUAL'
      and entity_type is null
      and (business_name is null or btrim(business_name) <> '')
    )
  )
);

create index client_applications_applicant_profile_id_idx
  on public.client_applications(applicant_profile_id);

create index client_applications_service_type_idx
  on public.client_applications(service_type);

create index client_applications_status_created_at_idx
  on public.client_applications(status, created_at desc);

create index client_applications_reviewer_profile_id_idx
  on public.client_applications(reviewer_profile_id);

create index client_applications_client_id_idx
  on public.client_applications(client_id);

create index client_applications_case_id_idx
  on public.client_applications(case_id);

create index client_applications_nib_idx
  on public.client_applications(nib)
  where nib is not null;

create index client_applications_npwp_idx
  on public.client_applications(npwp)
  where npwp is not null;

alter table public.client_applications enable row level security;

create table public.client_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'INACTIVE')),
  granted_by uuid references public.profiles(id) on delete set null,
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, client_id),
  check (
    (
      status = 'ACTIVE'
      and activated_at is not null
      and deactivated_at is null
    )
    or (
      status = 'INACTIVE'
      and deactivated_at is not null
    )
  )
);

create index client_members_client_id_idx
  on public.client_members(client_id);

create index client_members_status_idx
  on public.client_members(status);

create index client_members_granted_by_idx
  on public.client_members(granted_by);

alter table public.client_members enable row level security;

create or replace function public.set_client_onboarding_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger client_applications_set_updated_at
before update on public.client_applications
for each row
execute function public.set_client_onboarding_updated_at();

create trigger client_members_set_updated_at
before update on public.client_members
for each row
execute function public.set_client_onboarding_updated_at();

commit;
