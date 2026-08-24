-- Issue #64 — PROJECT, Part V.2: Preview Dokumen Formal (schema).
-- Lampiran PRD: SPEC_PROJECT_Part_V2_RAB_Formal.md, §Bagian Baru:
-- Preview Dokumen Formal. SCHEMA ONLY, tidak ada UI di migration ini.

begin;

-- ========================================================================
-- 1. company_settings — key-value sederhana, rekening SMA dkk
-- ========================================================================

create table public.company_settings (
  key text primary key,
  value text
);

alter table public.company_settings enable row level security;

-- Konfigurasi internal murni — admin-only, pola sama seperti
-- document_templates/service_type_codes (supervisor/internal
-- select-only, tidak ada akses client).
create policy company_settings_admin_all
  on public.company_settings
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy company_settings_supervisor_select
  on public.company_settings
  for select
  using (public.auth_role() = 'supervisor');

create policy company_settings_internal_select
  on public.company_settings
  for select
  using (public.auth_role() = 'internal');

-- Seed awal — placeholder, WAJIB diupdate Ray dengan rekening asli
-- sebelum preview dokumen dipakai untuk kirim penawaran beneran.
insert into public.company_settings (key, value) values
  ('bank_name', 'GANTI_DENGAN_NAMA_BANK'),
  ('bank_account_number', 'GANTI_DENGAN_NOMOR_REKENING'),
  ('bank_account_holder', 'Soul Mitra Abadi');

-- ========================================================================
-- 2. profiles.phone — nomor HP staff, untuk kontak di preview dokumen
-- ========================================================================

alter table public.profiles
  add column phone text;

commit;
