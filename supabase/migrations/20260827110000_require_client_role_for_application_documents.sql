-- Issue #88 — hardening jalur applicant untuk dokumen pengajuan.
-- Profile ACTIVE tetap wajib memiliki role client. Policy staff SELECT existing
-- tidak diubah oleh migration ini.

begin;

create or replace function public.validate_client_application_document_write()
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

  if public.auth_role() is distinct from 'client'
     or not public.is_active_client_onboarding_user()
     or application_owner is distinct from actor_id
     or application_status not in ('DRAFT', 'REVISION_REQUIRED')
  then
    raise exception 'Dokumen hanya dapat diubah oleh client aktif saat application dapat diedit';
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

drop policy client_application_documents_applicant_select_own
  on public.client_application_documents;
drop policy client_application_documents_applicant_insert_own
  on public.client_application_documents;
drop policy client_application_documents_applicant_delete_own
  on public.client_application_documents;

create policy client_application_documents_applicant_select_own
on public.client_application_documents
for select
to authenticated
using (
  public.auth_role() = 'client'
  and public.is_active_client_onboarding_user()
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
  public.auth_role() = 'client'
  and public.is_active_client_onboarding_user()
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
  public.auth_role() = 'client'
  and public.is_active_client_onboarding_user()
  and exists (
    select 1
    from public.client_applications application
    where application.id = application_id
      and application.applicant_profile_id = (select auth.uid())
      and application.status in ('DRAFT', 'REVISION_REQUIRED')
  )
);

drop policy client_application_storage_applicant_select_own on storage.objects;
drop policy client_application_storage_applicant_insert_own on storage.objects;
drop policy client_application_storage_applicant_delete_own on storage.objects;

create policy client_application_storage_applicant_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-application-documents'
  and public.auth_role() = 'client'
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
  and public.auth_role() = 'client'
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
  and public.auth_role() = 'client'
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

commit;
