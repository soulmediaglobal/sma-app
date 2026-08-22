-- Issue #57 — PROJECT, Part V: RLS tightening untuk case_quotations
-- dan case_quotation_items.
--
-- RLS asli (Part I, 20260822200000_project_part1_schema_foundation.sql)
-- memberi internal insert/update BEBAS tanpa batasan status — itu
-- bertentangan dengan PRD §4: "Hanya admin/supervisor yang boleh
-- mengubah status jadi SENT (memicu Buat Penawaran)". Migration ini
-- menutup celah itu SEBELUM UI builder dibangun, supaya proteksi ada
-- di level database, bukan cuma disembunyikan di UI (pola yang sama
-- dengan payments_internal_insert/update yang sudah ada, dan trigger
-- profiles_prevent_privilege_escalation).
--
-- Prinsip: internal boleh bikin/edit DRAFT sepenuhnya, tapi TIDAK BISA
-- membuat row yang sudah tidak-DRAFT ataupun mengubah row DRAFT jadi
-- status lain. admin/supervisor tetap ALL/setara tanpa batasan
-- (mereka yang boleh kirim penawaran).

begin;

-- ========================================================================
-- case_quotations — ganti policy internal_insert & internal_update
-- ========================================================================

drop policy if exists case_quotations_internal_insert on public.case_quotations;
drop policy if exists case_quotations_internal_update on public.case_quotations;

create policy case_quotations_internal_insert
  on public.case_quotations
  for insert
  with check (
    public.auth_role() = 'internal'
    and status = 'DRAFT'
  );

create policy case_quotations_internal_update
  on public.case_quotations
  for update
  using (
    public.auth_role() = 'internal'
    and status = 'DRAFT'
  )
  with check (
    public.auth_role() = 'internal'
    and status = 'DRAFT'
  );

-- ========================================================================
-- case_quotation_items — ganti policy internal_insert/update/delete,
-- tambahan: item cuma boleh disentuh internal kalau quotation induknya
-- masih DRAFT (join ke case_quotations.status)
-- ========================================================================

drop policy if exists case_quotation_items_internal_insert on public.case_quotation_items;
drop policy if exists case_quotation_items_internal_update on public.case_quotation_items;
drop policy if exists case_quotation_items_internal_delete on public.case_quotation_items;

create policy case_quotation_items_internal_insert
  on public.case_quotation_items
  for insert
  with check (
    public.auth_role() = 'internal'
    and exists (
      select 1
      from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status = 'DRAFT'
    )
  );

create policy case_quotation_items_internal_update
  on public.case_quotation_items
  for update
  using (
    public.auth_role() = 'internal'
    and exists (
      select 1
      from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status = 'DRAFT'
    )
  )
  with check (
    public.auth_role() = 'internal'
    and exists (
      select 1
      from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status = 'DRAFT'
    )
  );

create policy case_quotation_items_internal_delete
  on public.case_quotation_items
  for delete
  using (
    public.auth_role() = 'internal'
    and exists (
      select 1
      from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status = 'DRAFT'
    )
  );

commit;
