-- Issue #88 — application DRAFT dan REVISION_REQUIRED dapat disimpan parsial.
-- Service type tetap minimum wajib karena setiap application mewakili satu layanan.

begin;

do $$
declare
  matching_constraints name[];
begin
  select array_agg(constraint_name order by constraint_name)
  into matching_constraints
  from (
    select constraint_row.conname as constraint_name
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.client_applications'::regclass
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) ilike '%applicant_type%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%entity_type%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%business_name%'
  ) matching;

  if coalesce(cardinality(matching_constraints), 0) <> 1 then
    raise exception
      'Expected exactly one applicant/entity consistency constraint, found %.',
      coalesce(cardinality(matching_constraints), 0)
      using hint = 'Audit CHECK constraints public.client_applications before applying this migration.';
  end if;

  execute format(
    'alter table public.client_applications drop constraint %I',
    matching_constraints[1]
  );
end;
$$;

alter table public.client_applications
  alter column applicant_name drop not null,
  alter column pic_name drop not null,
  alter column pic_email drop not null,
  alter column whatsapp_number drop not null,
  alter column region drop not null,
  alter column needs_description drop not null;

alter table public.client_applications
  add constraint client_applications_submission_fields_complete_check
  check (
    status in ('DRAFT', 'REVISION_REQUIRED', 'CANCELLED')
    or (
      nullif(btrim(applicant_name), '') is not null
      and nullif(btrim(pic_name), '') is not null
      and nullif(btrim(pic_email), '') is not null
      and nullif(btrim(whatsapp_number), '') is not null
      and nullif(btrim(region), '') is not null
      and nullif(btrim(needs_description), '') is not null
      and (
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
    )
  );

comment on constraint client_applications_submission_fields_complete_check
  on public.client_applications is
  'Draft/revisi/cancelled boleh parsial; status review/final hanya menerima data submission lengkap.';

commit;
