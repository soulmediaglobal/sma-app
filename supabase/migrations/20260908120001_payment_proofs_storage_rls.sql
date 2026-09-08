begin;

create policy payment_proofs_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and public.auth_role() in ('admin', 'supervisor')
);

create policy payment_proofs_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.auth_role() in ('admin', 'supervisor')
);

create policy payment_proofs_creator_assignee_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.cases c
    where c.id::text = (storage.foldername(name))[1]
      and (c.created_by = (select auth.uid()) or c.assigned_to = (select auth.uid()))
  )
);

commit;
