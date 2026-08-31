-- Issue #88 — dependency form pengajuan layanan publik.
-- Client ACTIVE dapat membaca pilihan layanan, dan satu profile hanya boleh
-- memiliki satu application non-terminal pada satu waktu.

begin;

create policy service_type_codes_active_client_select
on public.service_type_codes
for select
to authenticated
using (
  public.auth_role() = 'client'
  and public.is_active_client_onboarding_user()
);

grant select on table public.service_type_codes to authenticated;

-- Tidak ada policy INSERT/UPDATE/DELETE untuk role client. Policy RLS existing
-- untuk pengelolaan service type oleh staff tetap dipertahankan apa adanya.

lock table public.client_applications in share row exclusive mode;

do $$
declare
  duplicate_profile_id uuid;
  duplicate_count bigint;
begin
  select applicant_profile_id, count(*)
  into duplicate_profile_id, duplicate_count
  from public.client_applications
  where status in (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'REVISION_REQUIRED',
    'APPROVED'
  )
  group by applicant_profile_id
  having count(*) > 1
  order by applicant_profile_id
  limit 1;

  if duplicate_profile_id is not null then
    raise exception
      'Tidak dapat menjamin satu application aktif: profile % memiliki % application non-terminal.',
      duplicate_profile_id,
      duplicate_count
      using hint = 'Tinjau duplikasi client_applications secara manual; migration tidak mengubah data existing.';
  end if;
end;
$$;

create unique index client_applications_one_non_terminal_per_profile_idx
on public.client_applications(applicant_profile_id)
where status in (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'REVISION_REQUIRED',
  'APPROVED'
);

commit;
