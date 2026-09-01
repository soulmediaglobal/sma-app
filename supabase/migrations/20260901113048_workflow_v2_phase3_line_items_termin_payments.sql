-- Issue #153 — PRD Workflow Layer v2.0, Fase 3 (Process)
-- Task 2/11 dari breakdown implementasi PRD_Workflow_Layer_SMA-app_v2.md
--
-- Menambahkan skema untuk:
--   1. §4.1 — hierarki step/sub-step/sub-sub-step (3 level) di
--      case_quotation_line_items ("Detail Pekerjaan", BUKAN
--      case_quotation_items yang ternyata tabel Termin)
--   2. §4.2 — linkage termin ke step: case_quotation_items dapat
--      referensi opsional ke case_quotation_line_items (bukan ke
--      nomor order_index — referensi langsung by id lebih tahan
--      terhadap reorder)
--   3. §4.3 — status verifikasi pembayaran per termin (kolom BARU,
--      terpisah dari payments.status yang sudah ada dan dipakai RLS
--      existing dengan value 'Pending'/'Lunas' — tidak diubah/ditimpa)
--
-- CATATAN VERIFIKASI SKEMA (sebelum menulis migration ini):
--   - case_quotation_items = tabel TERMIN (term_name/amount/
--     due_condition), bukan tabel item RAB seperti asumsi awal di
--     deskripsi issue.
--   - case_quotation_line_items = tabel "Detail Pekerjaan"
--     (description/detail/qty/rate/amount) — ini yang jadi tempat
--     hierarki step/sub-step PRD.
--   - payments.status sudah ada dengan value 'Pending'/'Lunas', RLS
--     payments_internal_insert/update HARDCODE ke 'Pending' — migration
--     ini TIDAK menyentuh kolom/value itu, menambah kolom terpisah
--     verification_status untuk sub-state di dalam fase 'Pending'.
--   - Tidak ada kolom penyimpan bukti transfer sama sekali di
--     payments, dan tidak ada RLS WRITE untuk role client di tabel
--     ini sebelumnya — keduanya baru, dikonfirmasi Ray sebelum
--     migration ini ditulis.

begin;

-- ============================================================
-- 1. case_quotation_line_items — hierarki step/sub-step (3 level)
-- ============================================================
alter table public.case_quotation_line_items
  add column if not exists parent_item_id uuid
    references public.case_quotation_line_items(id) on delete cascade;

comment on column public.case_quotation_line_items.parent_item_id is
  'Self-reference untuk hierarki step/sub-step/sub-sub-step, maksimal '
  '3 level (divalidasi di aplikasi, bukan constraint DB rekursif). '
  'NULL = step level 1. PRD_Workflow_Layer_SMA-app_v2.md §4.1.';

alter table public.case_quotation_line_items
  add column if not exists notes text;

comment on column public.case_quotation_line_items.notes is
  'Catatan step, secara fungsional cuma diisi di level 1 (UI-level '
  'convention, kolom tersedia di semua level untuk kesederhanaan skema).';

create index if not exists idx_case_quotation_line_items_parent_item_id
  on public.case_quotation_line_items(parent_item_id)
  where parent_item_id is not null;

-- ============================================================
-- 2. case_quotation_items — linkage termin ke step
-- ============================================================
alter table public.case_quotation_items
  add column if not exists required_before_line_item_id uuid
    references public.case_quotation_line_items(id) on delete set null;

comment on column public.case_quotation_items.required_before_line_item_id is
  'Termin ini harus TERVERIFIKASI sebelum step (case_quotation_line_items) '
  'yang direferensikan boleh mulai. NULL = termin tidak terikat ke step '
  'manapun. Referensi by id (bukan order_index) supaya tahan reorder. '
  'PRD_Workflow_Layer_SMA-app_v2.md §4.2.';

create index if not exists idx_case_quotation_items_required_before
  on public.case_quotation_items(required_before_line_item_id)
  where required_before_line_item_id is not null;

-- ============================================================
-- 3. payments — status verifikasi pembayaran (kolom baru, terpisah)
-- ============================================================
alter table public.payments
  add column if not exists verification_status text
    not null default 'BELUM_BAYAR'
    check (verification_status in ('BELUM_BAYAR', 'BUKTI_DIUPLOAD', 'TERVERIFIKASI'));

comment on column public.payments.verification_status is
  'Sub-state verifikasi bukti transfer, terpisah dari kolom status '
  '(Pending/Lunas) yang sudah ada. TERVERIFIKASI tidak otomatis '
  'mengubah status jadi Lunas — itu logic terpisah (task 9/11). '
  'PRD_Workflow_Layer_SMA-app_v2.md §4.3.';

alter table public.payments
  add column if not exists proof_url text;

alter table public.payments
  add column if not exists proof_uploaded_at timestamptz;

alter table public.payments
  add column if not exists proof_rejected_reason text;

comment on column public.payments.proof_rejected_reason is
  'Diisi admin saat menolak bukti transfer (verification_status balik '
  'ke BELUM_BAYAR, client upload ulang). NULL kalau belum pernah ditolak.';

-- ============================================================
-- 4. Trigger — batasi kolom yang boleh diubah client di payments
-- ============================================================
create or replace function public.prevent_client_payment_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth_role() != 'client' then
    return new;
  end if;

  if new.case_id is distinct from old.case_id
     or new.amount is distinct from old.amount
     or new.type is distinct from old.type
     or new.status is distinct from old.status
     or new.paid_at is distinct from old.paid_at
     or new.invoice_number is distinct from old.invoice_number
     or new.invoice_issued_at is distinct from old.invoice_issued_at
     or new.receipt_number is distinct from old.receipt_number
     or new.receipt_issued_at is distinct from old.receipt_issued_at
     or new.proof_rejected_reason is distinct from old.proof_rejected_reason
  then
    raise exception 'Client hanya boleh mengubah bukti transfer, tidak kolom lain.';
  end if;

  return new;
end;
$$;

create trigger payments_prevent_client_tampering
  before update on public.payments
  for each row
  execute function public.prevent_client_payment_tampering();

-- ============================================================
-- 5. RLS — client bisa UPDATE payment miliknya sendiri (baru,
--    sebelumnya client cuma SELECT-only di tabel ini)
-- ============================================================
create policy "payments_client_update_own"
  on public.payments
  for update
  using (
    verification_status = 'BELUM_BAYAR'
    and exists (
      select 1 from public.cases c
      where c.id = payments.case_id
        and c.client_id = auth_client_id()
    )
  )
  with check (
    verification_status = 'BUKTI_DIUPLOAD'
    and exists (
      select 1 from public.cases c
      where c.id = payments.case_id
        and c.client_id = auth_client_id()
    )
  );

commit;
