-- Issue #161 — PRD Workflow Layer v2.0, Task 4/11
-- RLS baru: role internal boleh reject (SENT -> REJECTED) HANYA kalau dia
-- adalah creator dari case terkait (cases.created_by). Melengkapi gap:
-- policy case_quotations_internal_update yang sudah ada cuma izinkan
-- internal update saat status masih DRAFT, tidak cover transisi
-- SENT->REJECTED yang dibutuhkan Task 4/11 untuk project creator internal.
-- Admin & supervisor sudah unrestricted lewat policy existing
-- (case_quotations_admin_all, case_quotations_supervisor_update),
-- jadi tidak perlu policy tambahan untuk mereka.
--
-- Sudah dijalankan & diverifikasi ke database (\d+ case_quotations)
-- sebelum file ini dicommit, sesuai C5P5.

begin;

create policy "case_quotations_internal_creator_reject"
on public.case_quotations
for update
using (
  auth_role() = 'internal'
  and status = 'SENT'
  and exists (
    select 1 from public.cases c
    where c.id = case_quotations.case_id
      and c.created_by = auth.uid()
  )
)
with check (
  status = 'REJECTED'
  and exists (
    select 1 from public.cases c
    where c.id = case_quotations.case_id
      and c.created_by = auth.uid()
  )
);

commit;
