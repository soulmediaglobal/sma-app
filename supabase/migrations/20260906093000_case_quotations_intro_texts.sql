-- Issue #200 -- RAB: 3 paragraf intro editable (Rincian Pekerjaan,
-- Dokumen, Tahapan).
--
-- Preview/print RAB (issue terpisah, depends on ini) butuh paragraf
-- pengantar sebelum tabel Rincian Pekerjaan, list Dokumen Wajib, dan
-- section baru Tahapan Pekerjaan. Teksnya bisa disesuaikan per-RAB
-- oleh admin/internal, bukan teks statis di kode.
--
-- DB default cuma berlaku untuk row BARU (insert tanpa value
-- eksplisit). RAB existing (NULL) ditangani di app layer (editor
-- pre-fill teks default, preview fallback ke teks default) -- tidak
-- ada backfill data.

begin;

alter table public.case_quotations
  add column if not exists line_items_intro text
    default 'Untuk layanan yang Bpk/Ibu minta maka berikut ini adalah detil dari pekerjaan yang akan kami lakukan.',
  add column if not exists documents_intro text
    default 'Agar kami bisa mengerjakan dengan baik, maka berikut adalah daftar dokumen yang kami butuhkan.',
  add column if not exists stages_intro text
    default 'Berikut adalah tahapan yang akan kami kerjakan.';

commit;
