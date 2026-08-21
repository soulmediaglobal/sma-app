-- Issue #36 — koreksi arah: revert generic workflow-engine (Task #33)
-- yang ternyata sudah ditolak di PRD_Workflow_Layer_SMA-app.md v1.0
-- (21 Agustus 2026, dibuat SETELAH SMA_APP_NEW_ARCHITECTURE.js, hasil
-- diskusi lanjutan), lalu membangun desain yang disepakati: 1 tabel
-- `case_stages` per case + `cases.current_stage_id`, bukan mesin
-- template/instance generic.
--
-- Task #33 baru dibuat hari ini (2026-08-22), belum ada data production
-- yang bergantung padanya — aman di-drop.

begin;

-- ========================================================================
-- BAGIAN 1: REVERT TASK #33
-- ========================================================================

drop table if exists public.workflow_stages cascade;
drop table if exists public.workflow_instances cascade;
drop table if exists public.workflow_template_stages cascade;
drop table if exists public.workflow_templates cascade;

-- ========================================================================
-- BAGIAN 2: case_stages (PRD §2.1)
-- ========================================================================

create table public.case_stages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null,
  order_index int not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'COMPLETED', 'SKIPPED', 'CANCELLED')),
  owner text not null default 'ADMIN'
    check (owner in ('ADMIN', 'CLIENT', 'SYSTEM')),
  blocking_reason text,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, order_index)
);

create index case_stages_case_id_idx on public.case_stages(case_id);

alter table public.case_stages enable row level security;

-- PRD §2.6: admin/supervisor ALL, internal SELECT+UPDATE (status/owner),
-- client SELECT-only lewat case_id miliknya.
create policy case_stages_admin_all
  on public.case_stages
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy case_stages_supervisor_all
  on public.case_stages
  for all
  using (public.auth_role() = 'supervisor')
  with check (public.auth_role() = 'supervisor');

create policy case_stages_internal_select
  on public.case_stages
  for select
  using (public.auth_role() = 'internal');

create policy case_stages_internal_update
  on public.case_stages
  for update
  using (public.auth_role() = 'internal')
  with check (public.auth_role() = 'internal');

create policy case_stages_client_select_own
  on public.case_stages
  for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.cases c
      where c.id = case_stages.case_id
        and c.client_id = public.auth_client_id()
    )
  );

-- ========================================================================
-- BAGIAN 3: cases.current_stage_id (PRD §2.2)
-- ========================================================================
-- current_owner TIDAK disimpan sebagai kolom terpisah — dihitung dari
-- case_stages yang ditunjuk current_stage_id, sesuai keputusan PRD
-- (biar tidak ada 2 sumber kebenaran).
--
-- cases.status (Baru/Proses/Selesai/Batal) SENGAJA tidak diubah/dihapus
-- — hubungannya dengan case_stages masih open question (PRD §4 poin 3),
-- jangan diputuskan sepihak di migration ini.

alter table public.cases
  add column current_stage_id uuid references public.case_stages(id) on delete set null;

-- ========================================================================
-- BAGIAN 4: document_versions (PRD §2.4)
-- ========================================================================

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number int not null,
  file_url text not null,
  status text not null default 'Upload'
    check (status in ('Belum', 'Upload', 'Terverifikasi', 'Ditolak')),
  rejection_reason text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create index document_versions_document_id_idx on public.document_versions(document_id);

-- rejection_reason wajib diisi kalau status Ditolak (PRD §2.4)
alter table public.document_versions
  add constraint document_versions_rejection_reason_required
  check (status <> 'Ditolak' or rejection_reason is not null);

alter table public.document_versions enable row level security;

-- PRD §2.6: admin/internal INSERT+SELECT, client INSERT terbatas (cuma
-- nambah versi baru, gak bisa ubah versi lama — table ini memang tidak
-- punya policy UPDATE sama sekali, jadi "gak bisa ubah versi lama"
-- otomatis benar untuk semua role, bukan cuma client).
--
-- CATATAN: PRD tidak menyebutkan supervisor secara eksplisit untuk tabel
-- ini. Diasumsikan supervisor mendapat akses yang sama dengan admin
-- (konsisten dengan pola di case_stages/documents/payments di mana
-- supervisor selalu setara-atau-lebih dari internal). Tolong konfirmasi
-- asumsi ini.
create policy document_versions_admin_select
  on public.document_versions
  for select
  using (public.auth_role() = 'admin');

create policy document_versions_admin_insert
  on public.document_versions
  for insert
  with check (public.auth_role() = 'admin');

create policy document_versions_supervisor_select
  on public.document_versions
  for select
  using (public.auth_role() = 'supervisor');

create policy document_versions_supervisor_insert
  on public.document_versions
  for insert
  with check (public.auth_role() = 'supervisor');

create policy document_versions_internal_select
  on public.document_versions
  for select
  using (public.auth_role() = 'internal');

create policy document_versions_internal_insert
  on public.document_versions
  for insert
  with check (public.auth_role() = 'internal');

create policy document_versions_client_select_own
  on public.document_versions
  for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.documents d
      join public.cases c on c.id = d.case_id
      where d.id = document_versions.document_id
        and c.client_id = public.auth_client_id()
    )
  );

create policy document_versions_client_insert_own
  on public.document_versions
  for insert
  with check (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.documents d
      join public.cases c on c.id = d.case_id
      where d.id = document_versions.document_id
        and c.client_id = public.auth_client_id()
    )
  );

-- ========================================================================
-- BAGIAN 5: perluasan payments (PRD §2.5)
-- ========================================================================

alter table public.payments
  add column invoice_number text,
  add column invoice_issued_at timestamptz,
  add column receipt_number text,
  add column receipt_issued_at timestamptz;

-- PRD §2.6: "kolom invoice/receipt cuma bisa diisi lewat aksi sistem
-- (generate invoice, verifikasi pembayaran) — bukan diedit bebas manual".
-- RLS existing di `payments` mengizinkan internal INSERT/UPDATE selama
-- status='Pending', tapi tidak membatasi KOLOM mana yang boleh diubah —
-- pola celah yang sama persis dengan yang kita tutup di `profiles` pagi
-- ini. Trigger di bawah menutup celah itu: hanya admin/supervisor yang
-- boleh mengisi/mengubah kolom invoice/receipt.
create or replace function public.prevent_payment_invoice_receipt_tampering()
returns trigger
language plpgsql
security definer
as $$
begin
  if public.auth_role() not in ('admin', 'supervisor')
     and (
       new.invoice_number is distinct from old.invoice_number
       or new.invoice_issued_at is distinct from old.invoice_issued_at
       or new.receipt_number is distinct from old.receipt_number
       or new.receipt_issued_at is distinct from old.receipt_issued_at
     )
  then
    raise exception 'Hanya admin/supervisor yang boleh mengubah nomor invoice/kuitansi';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_prevent_invoice_receipt_tampering on public.payments;

create trigger payments_prevent_invoice_receipt_tampering
before update on public.payments
for each row
execute function public.prevent_payment_invoice_receipt_tampering();

commit;
