-- Issue #60 — PROJECT, Part V.2: RAB Formal (schema).
-- Lampiran PRD: SPEC_PROJECT_Part_V2_RAB_Formal.md. Bukan revisi
-- Part V (v2.10.0) — penambahan. case_quotation_items (termin
-- pembayaran) TETAP DIPAKAI, tidak diubah/dihapus.
--
-- SCHEMA ONLY. Tidak ada trigger generate nomor RAB (task terpisah
-- setelah ini), tidak ada perubahan frontend.

begin;

-- ========================================================================
-- 1. service_type_codes — mapping service_type ke kode 3 huruf
-- ========================================================================

create table public.service_type_codes (
  service_type text primary key,
  code varchar(3) not null
);

alter table public.service_type_codes enable row level security;

-- Tabel konfigurasi internal — pola sama seperti document_templates:
-- admin manage, supervisor/internal select-only, tidak ada akses client.
create policy service_type_codes_admin_all
  on public.service_type_codes
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy service_type_codes_supervisor_select
  on public.service_type_codes
  for select
  using (public.auth_role() = 'supervisor');

create policy service_type_codes_internal_select
  on public.service_type_codes
  for select
  using (public.auth_role() = 'internal');

insert into public.service_type_codes (service_type, code) values
  ('PBG', 'PBG'),
  ('SLF', 'SLF'),
  ('NIB', 'NIB'),
  ('Pendirian PT', 'PPT'),
  ('Pendirian CV', 'PCV'),
  ('Pendirian Yayasan', 'PYY'),
  ('Pendirian PT + OSS', 'POS'),
  ('Perubahan Alamat', 'PAL'),
  ('Perubahan Pengurus', 'PPG'),
  ('Laporan Tahunan', 'LAP'),
  ('SIUP', 'SIU'),
  ('Izin Usaha', 'IZU'),
  ('Izin Lingkungan (UKL-UPL)', 'IZL'),
  ('Amdal', 'AMD'),
  ('Perpanjangan NIB', 'PNB'),
  ('Merek Dagang (HKI)', 'HKI'),
  ('BPJS Ketenagakerjaan', 'BPJ'),
  ('Akta Perubahan Modal', 'AKT'),
  ('Sertifikasi Halal', 'HAL'),
  ('Izin Operasional', 'IZO'),
  ('IMB ke PBG', 'IMB');

-- ========================================================================
-- 2. case_quotation_line_items — rincian pekerjaan (deskripsi, qty,
--    rate, amount) — BEDA dari case_quotation_items (termin pembayaran)
-- ========================================================================

create table public.case_quotation_line_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.case_quotations(id) on delete cascade,
  description text not null,
  detail text,
  qty numeric not null default 1,
  rate numeric not null,
  amount numeric not null,
  order_index int not null,
  unique (quotation_id, order_index)
);

create index case_quotation_line_items_quotation_id_idx on public.case_quotation_line_items(quotation_id);

alter table public.case_quotation_line_items enable row level security;

-- Pola RLS identik dengan case_quotation_items (Part I): admin ALL;
-- supervisor setara; internal dibatasi ke quotation berstatus DRAFT;
-- client SELECT-only via join ke cases.client_id.
create policy case_quotation_line_items_admin_all
  on public.case_quotation_line_items
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy case_quotation_line_items_supervisor_select
  on public.case_quotation_line_items
  for select
  using (public.auth_role() = 'supervisor');

create policy case_quotation_line_items_supervisor_insert
  on public.case_quotation_line_items
  for insert
  with check (public.auth_role() = 'supervisor');

create policy case_quotation_line_items_supervisor_update
  on public.case_quotation_line_items
  for update
  using (public.auth_role() = 'supervisor')
  with check (public.auth_role() = 'supervisor');

create policy case_quotation_line_items_supervisor_delete
  on public.case_quotation_line_items
  for delete
  using (public.auth_role() = 'supervisor');

create policy case_quotation_line_items_internal_select
  on public.case_quotation_line_items
  for select
  using (public.auth_role() = 'internal');

create policy case_quotation_line_items_internal_insert
  on public.case_quotation_line_items
  for insert
  with check (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status = 'DRAFT'
    )
  );

create policy case_quotation_line_items_internal_update
  on public.case_quotation_line_items
  for update
  using (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status = 'DRAFT'
    )
  )
  with check (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status = 'DRAFT'
    )
  );

create policy case_quotation_line_items_internal_delete
  on public.case_quotation_line_items
  for delete
  using (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status = 'DRAFT'
    )
  );

create policy case_quotation_line_items_client_select_own
  on public.case_quotation_line_items
  for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.case_quotations q
      join public.cases c on c.id = q.case_id
      where q.id = case_quotation_line_items.quotation_id
        and c.client_id = public.auth_client_id()
    )
  );

-- ========================================================================
-- 3. case_quotations — tambahan kolom
-- ========================================================================

alter table public.case_quotations
  add column quotation_number text,
  add column description text;

commit;
