-- Issue #88 — satu akun client dapat memiliki beberapa pengajuan layanan.
-- Migration 20260827100000 sudah pernah diterapkan, sehingga pembatas lama
-- dilepas melalui corrective migration dan bukan dengan mengubah history.

begin;

drop index if exists public.client_applications_one_non_terminal_per_profile_idx;

-- Helper onboarding hanya membuktikan profile milik session berstatus ACTIVE.
-- Jalur applicant tetap harus dikunci eksplisit ke role bisnis client agar
-- staff ACTIVE tidak dapat memakai policy applicant atas row miliknya sendiri.
drop policy if exists client_applications_applicant_select_own
  on public.client_applications;
drop policy if exists client_applications_applicant_insert_own_draft
  on public.client_applications;
drop policy if exists client_applications_applicant_update_own
  on public.client_applications;
drop policy if exists client_applications_applicant_delete_own_draft
  on public.client_applications;

create policy client_applications_applicant_select_own
on public.client_applications
for select
to authenticated
using (
  public.auth_role() = 'client'
  and public.is_active_client_onboarding_user()
  and applicant_profile_id = (select auth.uid())
);

create policy client_applications_applicant_insert_own_draft
on public.client_applications
for insert
to authenticated
with check (
  public.auth_role() = 'client'
  and public.is_active_client_onboarding_user()
  and applicant_profile_id = (select auth.uid())
  and status = 'DRAFT'
);

create policy client_applications_applicant_update_own
on public.client_applications
for update
to authenticated
using (
  public.auth_role() = 'client'
  and public.is_active_client_onboarding_user()
  and applicant_profile_id = (select auth.uid())
  and status in ('DRAFT', 'SUBMITTED', 'REVISION_REQUIRED')
)
with check (
  public.auth_role() = 'client'
  and public.is_active_client_onboarding_user()
  and applicant_profile_id = (select auth.uid())
  and status in ('DRAFT', 'SUBMITTED', 'REVISION_REQUIRED', 'CANCELLED')
);

create policy client_applications_applicant_delete_own_draft
on public.client_applications
for delete
to authenticated
using (
  public.auth_role() = 'client'
  and public.is_active_client_onboarding_user()
  and applicant_profile_id = (select auth.uid())
  and status = 'DRAFT'
);

revoke delete on table public.client_applications from anon;
revoke delete on table public.client_applications from public;
grant delete on table public.client_applications to authenticated;

comment on policy client_applications_applicant_select_own
  on public.client_applications is
  'Client ACTIVE hanya dapat membaca application miliknya sendiri.';

comment on policy client_applications_applicant_insert_own_draft
  on public.client_applications is
  'Client ACTIVE hanya dapat membuat application DRAFT miliknya sendiri.';

comment on policy client_applications_applicant_update_own
  on public.client_applications is
  'Client ACTIVE hanya dapat memperbarui application miliknya melalui state transition applicant yang divalidasi trigger.';

comment on policy client_applications_applicant_delete_own_draft
  on public.client_applications is
  'Client ACTIVE hanya dapat menghapus application DRAFT miliknya sendiri.';

commit;
