begin;

create policy client_documents_storage_admin_all
on storage.objects
for all
to authenticated
using (
  bucket_id = 'client-documents'
  and public.auth_role() = 'admin'
)
with check (
  bucket_id = 'client-documents'
  and public.auth_role() = 'admin'
);

create policy client_documents_storage_internal_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-documents'
  and public.auth_role() = 'internal'
);

create policy client_documents_storage_internal_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-documents'
  and public.auth_role() = 'internal'
);

create policy client_documents_storage_supervisor_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-documents'
  and public.auth_role() = 'supervisor'
);

commit;
