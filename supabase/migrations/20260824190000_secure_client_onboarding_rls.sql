-- Issue #82 — RLS dan proteksi field untuk onboarding Client Portal.
--
-- Object Storage memakai path:
--   <applicant_profile_id>/<application_id>/<nama-object>
--
-- Applicant tidak memiliki role global. Akses onboarding hanya diberikan
-- ketika auth.uid() memiliki profile ACTIVE. Role staff tetap berasal dari
-- public.auth_role() milik Issue #109 dan tidak diubah migration ini.

begin;

-- RLS membatasi row, bukan kolom. Pindahkan catatan internal ke tabel 1:1
-- agar applicant tetap aman ketika meminta select('*') atas application.
create table public.client_application_internal_notes (
  application_id uuid primary key
    references public.client_applications(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.client_application_internal_notes (
  application_id,
  notes,
  created_at,
  updated_at
)
select
  id,
  internal_notes,
  created_at,
  updated_at
from public.client_applications
where internal_notes is not null;

alter table public.client_application_internal_notes enable row level security;

create function public.validate_client_application_internal_note_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.application_id is distinct from old.application_id
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Relasi application dan created_at catatan internal tidak dapat diubah';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_client_application_internal_note_write() from public;

create trigger client_application_internal_notes_validate_write
before insert or update on public.client_application_internal_notes
for each row
execute function public.validate_client_application_internal_note_write();

alter table public.client_applications
  drop column internal_notes;

-- Helper ini sengaja tidak memakai auth_role(): applicant ACTIVE dapat belum
-- memiliki role. auth.uid() selalu diambil dari session, bukan dari argumen.
create function public.is_active_client_onboarding_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and account_status = 'ACTIVE'
  );
$$;

revoke all on function public.is_active_client_onboarding_user() from public;
grant execute on function public.is_active_client_onboarding_user() to authenticated;

-- Trigger ini menjadi guard kolom dan state transition untuk request manual.
-- RLS menentukan row yang dapat disentuh; trigger menentukan perubahan yang
-- sah dan mengisi timestamp workflow dari waktu database.
create function public.validate_client_application_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := public.auth_role();
  actor_is_staff boolean := coalesce(
    actor_role in ('internal', 'admin', 'supervisor'),
    false
  );
  actor_is_applicant boolean;
begin
  if tg_op = 'INSERT' then
    actor_is_applicant := public.is_active_client_onboarding_user()
      and new.applicant_profile_id = actor_id
      and not actor_is_staff;

    if not actor_is_applicant then
      raise exception 'Hanya applicant aktif yang dapat membuat application miliknya';
    end if;

    if new.status <> 'DRAFT' then
      raise exception 'Application baru wajib berstatus DRAFT';
    end if;

    if new.applicant_visible_revision_notes is not null
       or new.reviewer_profile_id is not null
       or new.client_id is not null
       or new.case_id is not null
       or new.submitted_at is not null
       or new.reviewed_at is not null
       or new.revision_requested_at is not null
       or new.approved_at is not null
       or new.rejected_at is not null
       or new.cancelled_at is not null
    then
      raise exception 'Applicant tidak dapat mengisi field review, relasi aktivasi, atau timestamp workflow';
    end if;

    new.id := gen_random_uuid();
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  actor_is_applicant := public.is_active_client_onboarding_user()
    and old.applicant_profile_id = actor_id
    and new.applicant_profile_id = actor_id
    and not actor_is_staff;

  if actor_is_applicant then
    if new.id is distinct from old.id
       or new.applicant_profile_id is distinct from old.applicant_profile_id
       or new.applicant_visible_revision_notes is distinct from old.applicant_visible_revision_notes
       or new.reviewer_profile_id is distinct from old.reviewer_profile_id
       -- Issue #82 sengaja membuat client_id dan case_id immutable.
       -- Aktivasi Issue #92 wajib menyediakan jalur database tervalidasi atau
       -- mengganti guard ini melalui migration baru; tidak ada jalur aktivasi
       -- yang dibuka dalam migration ini.
       or new.client_id is distinct from old.client_id
       or new.case_id is distinct from old.case_id
       or new.created_at is distinct from old.created_at
       or row(
         new.submitted_at,
         new.reviewed_at,
         new.revision_requested_at,
         new.approved_at,
         new.rejected_at,
         new.cancelled_at
       ) is distinct from row(
         old.submitted_at,
         old.reviewed_at,
         old.revision_requested_at,
         old.approved_at,
         old.rejected_at,
         old.cancelled_at
       )
    then
      raise exception 'Applicant tidak dapat mengubah field identitas, review, relasi aktivasi, atau timestamp workflow';
    end if;

    if old.status in ('DRAFT', 'REVISION_REQUIRED') then
      if new.status not in (old.status, 'SUBMITTED', 'CANCELLED') then
        raise exception 'Transisi status applicant tidak diizinkan: % -> %', old.status, new.status;
      end if;
    elsif old.status = 'SUBMITTED' then
      if new.status <> 'CANCELLED' then
        raise exception 'Application SUBMITTED hanya dapat dibatalkan oleh applicant';
      end if;

      if row(
        new.applicant_type,
        new.entity_type,
        new.service_type,
        new.applicant_name,
        new.business_name,
        new.nib,
        new.npwp,
        new.pic_name,
        new.pic_email,
        new.whatsapp_number,
        new.region,
        new.needs_description
      ) is distinct from row(
        old.applicant_type,
        old.entity_type,
        old.service_type,
        old.applicant_name,
        old.business_name,
        old.nib,
        old.npwp,
        old.pic_name,
        old.pic_email,
        old.whatsapp_number,
        old.region,
        old.needs_description
      ) then
        raise exception 'Data bisnis tidak dapat diubah setelah application disubmit';
      end if;
    else
      raise exception 'Application berstatus % tidak dapat diubah oleh applicant', old.status;
    end if;

    if new.status = 'SUBMITTED' and old.status in ('DRAFT', 'REVISION_REQUIRED') then
      new.submitted_at := now();
    elsif new.status = 'CANCELLED' and old.status in ('DRAFT', 'SUBMITTED', 'REVISION_REQUIRED') then
      new.cancelled_at := now();
    end if;

    return new;
  end if;

  if actor_is_staff then
    if new.id is distinct from old.id
       or new.applicant_profile_id is distinct from old.applicant_profile_id
       -- Issue #82 sengaja membuat client_id dan case_id immutable.
       -- Aktivasi Issue #92 wajib menyediakan jalur database tervalidasi atau
       -- mengganti guard ini melalui migration baru.
       or new.client_id is distinct from old.client_id
       or new.case_id is distinct from old.case_id
       or new.created_at is distinct from old.created_at
       or row(
         new.applicant_type,
         new.entity_type,
         new.service_type,
         new.applicant_name,
         new.business_name,
         new.nib,
         new.npwp,
         new.pic_name,
         new.pic_email,
         new.whatsapp_number,
         new.region,
         new.needs_description
       ) is distinct from row(
         old.applicant_type,
         old.entity_type,
         old.service_type,
         old.applicant_name,
         old.business_name,
         old.nib,
         old.npwp,
         old.pic_name,
         old.pic_email,
         old.whatsapp_number,
         old.region,
         old.needs_description
       )
       or row(
         new.submitted_at,
         new.reviewed_at,
         new.revision_requested_at,
         new.approved_at,
         new.rejected_at,
         new.cancelled_at
       ) is distinct from row(
         old.submitted_at,
         old.reviewed_at,
         old.revision_requested_at,
         old.approved_at,
         old.rejected_at,
         old.cancelled_at
       )
       or new.reviewer_profile_id is distinct from old.reviewer_profile_id
    then
      raise exception 'Staff tidak dapat mengubah data applicant, relasi aktivasi, atau field workflow secara langsung';
    end if;

    if new.applicant_visible_revision_notes is distinct from old.applicant_visible_revision_notes
       and not (
         (old.status = 'UNDER_REVIEW' and new.status = 'REVISION_REQUIRED')
         or (old.status = 'REVISION_REQUIRED' and new.status = 'REVISION_REQUIRED')
       )
    then
      raise exception 'Catatan revisi hanya dapat diubah saat meminta atau memperbaiki revisi';
    end if;

    if new.status = old.status then
      return new;
    end if;

    if actor_role = 'internal' then
      if not (
        (old.status = 'SUBMITTED' and new.status = 'UNDER_REVIEW')
        or (old.status = 'UNDER_REVIEW' and new.status = 'REVISION_REQUIRED')
      ) then
        raise exception 'Transisi status tidak diizinkan untuk internal: % -> %', old.status, new.status;
      end if;
    elsif not (
      (old.status = 'SUBMITTED' and new.status = 'UNDER_REVIEW')
      or (old.status = 'UNDER_REVIEW' and new.status in ('REVISION_REQUIRED', 'APPROVED', 'REJECTED'))
    ) then
      raise exception 'Transisi status tidak diizinkan untuk admin/supervisor: % -> %', old.status, new.status;
    end if;

    new.reviewer_profile_id := actor_id;

    if new.status = 'UNDER_REVIEW' then
      new.reviewed_at := now();
    elsif new.status = 'REVISION_REQUIRED' then
      new.revision_requested_at := now();
    elsif new.status = 'APPROVED' then
      new.approved_at := now();
    elsif new.status = 'REJECTED' then
      new.rejected_at := now();
    end if;

    return new;
  end if;

  raise exception 'Akun tidak berwenang mengubah client application';
end;
$$;

revoke all on function public.validate_client_application_write() from public;

create trigger client_applications_validate_onboarding_write
before insert or update on public.client_applications
for each row
execute function public.validate_client_application_write();

-- Metadata dokumen harus tetap menunjuk application dan path yang sama.
-- Penggantian file dilakukan dengan DELETE + INSERT, bukan memindahkan row.
create function public.validate_client_application_document_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  expected_prefix text;
  application_status text;
  application_owner uuid;
begin
  select status, applicant_profile_id
  into application_status, application_owner
  from public.client_applications
  where id = new.application_id;

  if not public.is_active_client_onboarding_user()
     or application_owner is distinct from actor_id
     or application_status not in ('DRAFT', 'REVISION_REQUIRED')
  then
    raise exception 'Dokumen hanya dapat diubah oleh applicant aktif saat application dapat diedit';
  end if;

  expected_prefix := actor_id::text || '/' || new.application_id::text || '/';

  if new.uploaded_by_profile_id is distinct from actor_id
     or left(new.storage_path, length(expected_prefix)) <> expected_prefix
     or length(new.storage_path) <= length(expected_prefix)
     or position('/' in substring(new.storage_path from length(expected_prefix) + 1)) > 0
     or nullif(
       btrim(substring(new.storage_path from length(expected_prefix) + 1)),
       ''
     ) is null
  then
    raise exception 'Identitas uploader atau storage_path dokumen tidak valid';
  end if;

  if tg_op = 'INSERT' then
    new.id := gen_random_uuid();
    new.created_at := now();
    new.updated_at := now();
  elsif (
       new.id is distinct from old.id
       or new.application_id is distinct from old.application_id
       or new.storage_path is distinct from old.storage_path
       or new.uploaded_by_profile_id is distinct from old.uploaded_by_profile_id
       or new.created_at is distinct from old.created_at
     )
  then
    raise exception 'Relasi application, storage_path, dan uploader dokumen tidak dapat diubah';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_client_application_document_write() from public;

create trigger client_application_documents_validate_onboarding_write
before insert or update on public.client_application_documents
for each row
execute function public.validate_client_application_document_write();

-- client_applications: applicant memiliki row sendiri; staff aktif membaca
-- semua row. Trigger di atas mempersempit field dan transisi UPDATE.
create policy client_applications_applicant_select_own
on public.client_applications
for select
to authenticated
using (
  public.is_active_client_onboarding_user()
  and applicant_profile_id = (select auth.uid())
);

create policy client_applications_applicant_insert_own_draft
on public.client_applications
for insert
to authenticated
with check (
  public.is_active_client_onboarding_user()
  and applicant_profile_id = (select auth.uid())
  and status = 'DRAFT'
);

create policy client_applications_applicant_update_own
on public.client_applications
for update
to authenticated
using (
  public.is_active_client_onboarding_user()
  and applicant_profile_id = (select auth.uid())
  and status in ('DRAFT', 'SUBMITTED', 'REVISION_REQUIRED')
)
with check (
  public.is_active_client_onboarding_user()
  and applicant_profile_id = (select auth.uid())
  and status in ('DRAFT', 'SUBMITTED', 'REVISION_REQUIRED', 'CANCELLED')
);

create policy client_applications_staff_select
on public.client_applications
for select
to authenticated
using (public.auth_role() in ('internal', 'admin', 'supervisor'));

create policy client_applications_staff_update
on public.client_applications
for update
to authenticated
using (public.auth_role() in ('internal', 'admin', 'supervisor'))
with check (public.auth_role() in ('internal', 'admin', 'supervisor'));

-- Tabel catatan internal sengaja tidak memiliki policy applicant maupun
-- DELETE. Staff aktif dapat membaca dan melakukan upsert melalui INSERT/UPDATE.
create policy client_application_internal_notes_staff_select
on public.client_application_internal_notes
for select
to authenticated
using (public.auth_role() in ('internal', 'admin', 'supervisor'));

create policy client_application_internal_notes_staff_insert
on public.client_application_internal_notes
for insert
to authenticated
with check (public.auth_role() in ('internal', 'admin', 'supervisor'));

create policy client_application_internal_notes_staff_update
on public.client_application_internal_notes
for update
to authenticated
using (public.auth_role() in ('internal', 'admin', 'supervisor'))
with check (public.auth_role() in ('internal', 'admin', 'supervisor'));

-- Metadata dokumen application.
create policy client_application_documents_applicant_select_own
on public.client_application_documents
for select
to authenticated
using (
  public.is_active_client_onboarding_user()
  and exists (
    select 1
    from public.client_applications application
    where application.id = application_id
      and application.applicant_profile_id = (select auth.uid())
  )
);

create policy client_application_documents_applicant_insert_own
on public.client_application_documents
for insert
to authenticated
with check (
  public.is_active_client_onboarding_user()
  and uploaded_by_profile_id = (select auth.uid())
  and storage_path like (
    (select auth.uid())::text || '/' || application_id::text || '/%'
  )
  and exists (
    select 1
    from public.client_applications application
    where application.id = application_id
      and application.applicant_profile_id = (select auth.uid())
      and application.status in ('DRAFT', 'REVISION_REQUIRED')
  )
);

create policy client_application_documents_applicant_delete_own
on public.client_application_documents
for delete
to authenticated
using (
  public.is_active_client_onboarding_user()
  and exists (
    select 1
    from public.client_applications application
    where application.id = application_id
      and application.applicant_profile_id = (select auth.uid())
      and application.status in ('DRAFT', 'REVISION_REQUIRED')
  )
);

create policy client_application_documents_staff_select
on public.client_application_documents
for select
to authenticated
using (public.auth_role() in ('internal', 'admin', 'supervisor'));

-- Privilege tabel public dibuat eksplisit dan minimal. Applicant serta staff
-- sama-sama memakai role authenticated; RLS di atas tetap menentukan row dan
-- operasi efektif masing-masing aktor.
revoke all privileges on table public.client_applications from anon;
revoke all privileges on table public.client_applications from public;
grant select, insert, update
  on table public.client_applications
  to authenticated;

revoke all privileges on table public.client_application_documents from anon;
revoke all privileges on table public.client_application_documents from public;
grant select, insert, delete
  on table public.client_application_documents
  to authenticated;

revoke all privileges on table public.client_application_internal_notes from anon;
revoke all privileges on table public.client_application_internal_notes from public;
grant select, insert, update
  on table public.client_application_internal_notes
  to authenticated;

-- Private Storage. Folder pertama dan kedua mengikat object ke pemilik serta
-- application. Tidak ada policy anonim dan seluruh policy dibatasi bucket.
create policy client_application_storage_applicant_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-application-documents'
  and public.is_active_client_onboarding_user()
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and nullif(btrim(storage.filename(name)), '') is not null
  and exists (
    select 1
    from public.client_applications application
    where application.id::text = (storage.foldername(name))[2]
      and application.applicant_profile_id = (select auth.uid())
  )
);

create policy client_application_storage_applicant_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-application-documents'
  and public.is_active_client_onboarding_user()
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and nullif(btrim(storage.filename(name)), '') is not null
  and exists (
    select 1
    from public.client_applications application
    where application.id::text = (storage.foldername(name))[2]
      and application.applicant_profile_id = (select auth.uid())
      and application.status in ('DRAFT', 'REVISION_REQUIRED')
  )
);

create policy client_application_storage_applicant_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-application-documents'
  and public.is_active_client_onboarding_user()
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and array_length(storage.foldername(name), 1) = 2
  and nullif(btrim(storage.filename(name)), '') is not null
  and exists (
    select 1
    from public.client_applications application
    where application.id::text = (storage.foldername(name))[2]
      and application.applicant_profile_id = (select auth.uid())
      and application.status in ('DRAFT', 'REVISION_REQUIRED')
  )
);

create policy client_application_storage_staff_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-application-documents'
  and public.auth_role() in ('internal', 'admin', 'supervisor')
);

commit;
