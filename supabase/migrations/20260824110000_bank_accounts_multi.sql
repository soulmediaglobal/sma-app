-- Issue #74 — Project Setting: Multi Rekening Bank (schema).
-- Perluasan dari company_settings (v2.13.0, single rekening key-value)
-- jadi tabel proper yang bisa nampung banyak rekening, dipilih per-RAB
-- saat dibuat. company_settings TIDAK dihapus (masih ada kalau
-- dibutuhkan untuk setting lain nanti), tapi tidak dipakai lagi untuk
-- info rekening ke depannya.

begin;

-- ========================================================================
-- 1. bank_accounts — bisa lebih dari satu, dipilih per-RAB
-- ========================================================================

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  account_holder_name text not null,
  account_number text not null,
  bank_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.bank_accounts enable row level security;

-- Konfigurasi internal — pola sama seperti document_templates/
-- service_type_codes: admin manage, supervisor/internal select-only,
-- tidak ada akses client.
create policy bank_accounts_admin_all
  on public.bank_accounts
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy bank_accounts_supervisor_select
  on public.bank_accounts
  for select
  using (public.auth_role() = 'supervisor');

create policy bank_accounts_internal_select
  on public.bank_accounts
  for select
  using (public.auth_role() = 'internal');

-- Migrasi data lama dari company_settings (BCA yang sudah diisi Ray
-- di v2.13.0) jadi baris pertama di tabel baru ini.
insert into public.bank_accounts (bank_name, account_holder_name, account_number, bank_code)
select
  (select value from public.company_settings where key = 'bank_name'),
  (select value from public.company_settings where key = 'bank_account_holder'),
  (select value from public.company_settings where key = 'bank_account_number'),
  '014' -- kode bank BCA
where exists (select 1 from public.company_settings where key = 'bank_name');

-- ========================================================================
-- 2. case_quotations.bank_account_id — rekening yang dipilih per-RAB
-- ========================================================================

alter table public.case_quotations
  add column bank_account_id uuid references public.bank_accounts(id) on delete set null;

commit;
