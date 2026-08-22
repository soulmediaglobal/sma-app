-- Issue (belum dibuat saat file ini ditulis) — PROJECT, Part II:
-- Rekonsiliasi Data Existing.
--
-- Part I (Issue #42) menambahkan cases.intake_status dengan default
-- 'DRAFT' ke SEMUA case, termasuk 42 case yang sudah berjalan (punya
-- case_stages dari seeding sebelum PRD Intake ini ada). Task ini
-- membetulkan itu secara retroaktif: case yang sudah punya
-- case_stages dianggap sudah "melewati" tahap penawaran, jadi
-- intake_status-nya di-set ACCEPTED.
--
-- Kriteria: case dengan minimal 1 baris case_stages -> ACCEPTED.
-- Case TANPA case_stages sama sekali (per pengecekan manual sebelum
-- migration ini ditulis: cuma 1 case, "Tau Bbanget" - SLF) TIDAK
-- disentuh, tetap DRAFT — itu memang belum melewati tahap apapun,
-- bukan pengecualian yang perlu ditangani khusus, murni konsekuensi
-- logis dari kriteria di atas.
--
-- Setiap case yang direkonsiliasi juga dapat 1 baris case_quotations
-- dummy berstatus ACCEPTED, supaya konsisten dengan model baru (setiap
-- case yang sudah diterima punya jejak quotation, bukan cuma
-- intake_status berubah tanpa riwayat).

begin;

do $$
declare
  case_row record;
  quotation_id uuid;
  total_rab_value numeric;
  reconciled_count int := 0;
begin
  for case_row in
    select ca.id, ca.total_rab
    from public.cases ca
    where exists (select 1 from public.case_stages cs where cs.case_id = ca.id)
      and ca.intake_status = 'DRAFT'
  loop
    update public.cases
    set intake_status = 'ACCEPTED'
    where id = case_row.id;

    total_rab_value := coalesce(case_row.total_rab, 0);
    quotation_id := gen_random_uuid();

    insert into public.case_quotations
      (id, case_id, version, status, total_amount, notes, sent_at, responded_at)
    values (
      quotation_id,
      case_row.id,
      1,
      'ACCEPTED',
      total_rab_value,
      'Direkonsiliasi retroaktif dari data existing (Part II) — project ini sudah berjalan sebelum alur intake/RAB dibangun, jadi tidak ada riwayat negosiasi asli.',
      now() - interval '14 days',
      now() - interval '13 days'
    );

    -- 1 baris item, mewakili total_rab sebagai satu termin generik.
    -- Rincian termin yang sesungguhnya (kalau ada) tidak tercatat di
    -- data lama, jadi ini best-effort, bukan representasi akurat.
    insert into public.case_quotation_items
      (id, quotation_id, term_name, amount, due_condition, order_index)
    values (
      gen_random_uuid(),
      quotation_id,
      'Total (direkonsiliasi)',
      total_rab_value,
      'Data lama, rincian termin asli tidak tercatat',
      1
    );

    reconciled_count := reconciled_count + 1;
  end loop;

  raise notice 'Direkonsiliasi: % case', reconciled_count;
end $$;

commit;
