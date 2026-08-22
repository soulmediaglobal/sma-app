-- Issue #39 — seed case_stages untuk semua project (cases) yang sudah
-- ada, supaya tab Workflow yang disambungkan ke data real (bukan lagi
-- dummy JS) punya sesuatu untuk ditampilkan.
--
-- PENTING: nama & jumlah stage di bawah ini (6 tahap generik) BUKAN
-- keputusan final — PRD_Workflow_Layer_SMA-app.md §4 poin 1 eksplisit
-- bilang nama stage default per jenis layanan belum ditentukan Ray.
-- Dipakai di sini biar konsisten sama yang sudah pernah didemokan
-- (tab Workflow dummy sebelumnya), gampang diganti lewat migration
-- baru begitu nama final disepakati.
--
-- Status tiap stage disusun supaya KONSISTEN dengan cases.status yang
-- sudah ada sekarang — trigger sync_case_status_from_stages (Issue #38)
-- otomatis menghitung ulang cases.status setiap INSERT, jadi kalau
-- polanya salah, akan langsung kelihatan dari cases.status yang
-- berubah tidak sesuai harapan.

begin;

do $$
declare
  case_row record;
  stage_names text[] := array[
    'Pengumpulan Dokumen', 'Verifikasi Dokumen', 'Revisi Dokumen',
    'Proses Administrasi', 'Pembayaran', 'Selesai'
  ];
  stage_owners text[] := array['CLIENT', 'ADMIN', 'CLIENT', 'ADMIN', 'CLIENT', 'SYSTEM'];
  stage_statuses text[];
  i int;
  new_stage_id uuid;
  in_progress_stage_id uuid;
begin
  for case_row in select id, status from public.cases loop

    -- Idempotency: skip kalau case ini sudah punya stage (aman dijalankan ulang)
    if exists (select 1 from public.case_stages where case_id = case_row.id) then
      continue;
    end if;

    if case_row.status = 'Selesai' then
      stage_statuses := array['COMPLETED','COMPLETED','COMPLETED','COMPLETED','COMPLETED','COMPLETED'];
    elsif case_row.status = 'Proses' then
      stage_statuses := array['COMPLETED','COMPLETED','IN_PROGRESS','PENDING','PENDING','PENDING'];
    elsif case_row.status = 'Batal' then
      -- Batal: stage 1 tetap COMPLETED (progress yang sudah terjadi
      -- sebelum dibatalkan), sisanya CANCELLED. cases.status TIDAK
      -- akan berubah otomatis di sini karena trigger sync melindungi
      -- status 'Batal' (lihat WHERE status <> 'Batal' di Issue #38).
      stage_statuses := array['COMPLETED','CANCELLED','CANCELLED','CANCELLED','CANCELLED','CANCELLED'];
    else
      -- 'Baru' atau nilai lain yang tidak dikenal
      stage_statuses := array['PENDING','PENDING','PENDING','PENDING','PENDING','PENDING'];
    end if;

    in_progress_stage_id := null;

    for i in 1..6 loop
      new_stage_id := gen_random_uuid();

      insert into public.case_stages
        (id, case_id, name, order_index, status, owner, started_at, completed_at)
      values (
        new_stage_id,
        case_row.id,
        stage_names[i],
        i,
        stage_statuses[i],
        stage_owners[i],
        case when stage_statuses[i] in ('COMPLETED', 'IN_PROGRESS', 'CANCELLED')
          then now() - ((7 - i) || ' days')::interval
          else null
        end,
        case when stage_statuses[i] = 'COMPLETED'
          then now() - ((6 - i) || ' days')::interval
          else null
        end
      );

      if stage_statuses[i] = 'IN_PROGRESS' then
        in_progress_stage_id := new_stage_id;
      end if;
    end loop;

    -- current_stage_id: stage IN_PROGRESS kalau ada; kalau Selesai ->
    -- stage terakhir; kalau Baru -> stage pertama; kalau Batal -> tetap
    -- NULL (tidak ada yang "sedang berjalan").
    if in_progress_stage_id is not null then
      update public.cases set current_stage_id = in_progress_stage_id where id = case_row.id;
    elsif case_row.status = 'Selesai' then
      update public.cases c set current_stage_id = cs.id
        from public.case_stages cs
        where cs.case_id = case_row.id and cs.order_index = 6 and c.id = case_row.id;
    elsif case_row.status = 'Baru' then
      update public.cases c set current_stage_id = cs.id
        from public.case_stages cs
        where cs.case_id = case_row.id and cs.order_index = 1 and c.id = case_row.id;
    end if;

  end loop;
end $$;

commit;
