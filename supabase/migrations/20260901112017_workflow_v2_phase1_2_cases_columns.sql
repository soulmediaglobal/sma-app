-- Issue #151 — PRD Workflow Layer v2.0, Fase 1 & 2 (Iniciate + Approval)
-- Task 1/11 dari breakdown implementasi PRD_Workflow_Layer_SMA-app_v2.md
--
-- Menambahkan skema untuk:
--   1. Fase 1 (Iniciate) §2.3 — dependency antar-case: case bisa
--      berstatus ON_HOLD sambil menunggu case prasyarat selesai
--   2. Fase 2 (Approval) §3.2 — counter siklus negosiasi RAB, dipakai
--      untuk auto-reject otomatis setelah 3x nego (logic auto-reject
--      itu sendiri ada di task terpisah, bukan migration ini)
--
-- CATATAN PENTING (diverifikasi via \d+ cases sebelum menulis migration
-- ini): kolom cases.status TIDAK punya CHECK constraint sama sekali
-- (beda dari cases.intake_status yang punya). Validasi value status
-- ('Baru'/'Proses'/'Selesai'/'Batal', dan sekarang 'ON_HOLD') murni
-- di level aplikasi/JS. Migration ini SENGAJA TIDAK menambah CHECK
-- constraint baru ke kolom status — itu perubahan terpisah yang lebih
-- besar (berisiko terhadap data existing yang tidak terduga), di luar
-- scope task ini. 'ON_HOLD' cukup ditambahkan sebagai value yang
-- dipakai aplikasi, tidak butuh perubahan skema untuk itu sendiri.

begin;

-- ============================================================
-- 1. cases.blocked_by_case_id — referensi ke case prasyarat
-- ============================================================
-- ON DELETE SET NULL: kalau case prasyarat dihapus, case yang nunggu
-- TIDAK ikut terhapus (beda dari client_id yang CASCADE) — cuma
-- referensinya dikosongkan, karena "menunggu case yang sudah tidak
-- ada" secara bisnis berarti tidak ada lagi yang perlu ditunggu,
-- bukan berarti case ini sendiri jadi tidak valid.
alter table public.cases
  add column if not exists blocked_by_case_id uuid
    references public.cases(id) on delete set null;

comment on column public.cases.blocked_by_case_id is
  'Referensi ke case lain yang harus selesai (intake_status=ACCEPTED) '
  'dulu sebelum case ini bisa lanjut. NULL berarti tidak ada dependency. '
  'Diisi otomatis oleh logic Fase 1 Iniciate (task terpisah dari migration ini).';

create index if not exists idx_cases_blocked_by_case_id
  on public.cases(blocked_by_case_id)
  where blocked_by_case_id is not null;

-- ============================================================
-- 2. cases.negotiation_count — counter siklus nego RAB
-- ============================================================
alter table public.cases
  add column if not exists negotiation_count integer not null default 0;

comment on column public.cases.negotiation_count is
  'Jumlah siklus negosiasi RAB yang sudah terjadi untuk case ini. '
  'Maksimal 3 (PRD_Workflow_Layer_SMA-app_v2.md §3.2) — setelah itu '
  'auto-reject. Diincrement oleh logic Fase 2 Approval (task terpisah '
  'dari migration ini), bukan oleh migration ini.';

alter table public.cases
  add constraint cases_negotiation_count_non_negative
    check (negotiation_count >= 0);

commit;
