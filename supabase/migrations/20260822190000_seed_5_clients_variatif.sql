-- Issue #40 lanjutan — tambah 5 client + project bervariasi untuk demo
-- data yang lebih representatif (bukan cuma 9 client lama yang beberapa
-- di antaranya kosong/testing). Reuse pola seeding case_stages yang
-- sama seperti migration sebelumnya, dengan variasi posisi "sedang
-- berjalan" biar tidak semua project Proses keliatan sama persis.
--
-- Tidak ada perubahan kode JS di task ini — semua tab (Info/Project/
-- Dokumen/Pembayaran/Aktivitas/Workflow) sudah query dinamis by
-- clientId, jadi data baru otomatis muncul begitu di-insert.

begin;

do $$
declare
  client_ids uuid[] := array[]::uuid[];
  v_case_id uuid;
  stage_names text[] := array[
    'Pengumpulan Dokumen', 'Verifikasi Dokumen', 'Revisi Dokumen',
    'Proses Administrasi', 'Pembayaran', 'Selesai'
  ];
  stage_owners text[] := array['CLIENT', 'ADMIN', 'CLIENT', 'ADMIN', 'CLIENT', 'SYSTEM'];
  stage_statuses text[];
  proses_pos int;
  i int;
  new_stage_id uuid;
  in_progress_stage_id uuid;

  -- Data 5 client baru
  new_clients text[][] := array[
    array['PT Sinar Abadi Konstruksi','PT','01.234.111.1-111.000','Jasa Konstruksi Bangunan (41011)','Jl. Kaliurang KM 8, Sleman, DIY','Rina Wulandari','Manajer Operasional','0813 1111 2222','rina@sinarabadikonstruksi.co.id','Hendra Susanto','0812 1111 3333','3404xxxxxxxxxxxx','Google Ads','Fokus proyek gedung komersial'],
    array['CV Berkah Jaya Mandiri','CV','01.234.222.2-222.000','Perdagangan Umum (46900)','Jl. Magelang No. 45, Yogyakarta','Dedi Kurniawan','Owner','0813 2222 3333','dedi@berkahjaya.co.id','Dedi Kurniawan','0813 2222 3333','3471xxxxxxxxxxxx','Rekomendasi klien lama','Klien lama, sudah 2 tahun langganan'],
    array['Yayasan Peduli Nusantara','Yayasan','01.234.333.3-333.000','Kegiatan Sosial (94991)','Jl. Solo KM 10, Sleman, DIY','Siti Aminah','Ketua Yayasan','0813 3333 4444','siti@pedulinusantara.org','Siti Aminah','0813 3333 4444','3404xxxxxxxxxxxx','Referral notaris','Yayasan pendidikan, butuh legalitas lengkap'],
    array['PT Global Teknologi Nusantara','PT','01.234.444.4-444.000','Aktivitas Pemrograman Komputer (62010)','Jl. Ring Road Utara No. 88, Sleman, DIY','Andri Prasetyo','CTO','0813 4444 5555','andri@globalteknologi.id','Michael Tanoto','0812 4444 6666','3404xxxxxxxxxxxx','Website form','Startup teknologi, growth cepat, banyak izin sekaligus'],
    array['Bambang Wijaya','Perorangan','01.234.555.5-555.000','Konsultan Independen (70209)','Jl. Gejayan No. 12, Yogyakarta','Bambang Wijaya','Pemilik Usaha','0813 5555 6666','bambang.w@gmail.com','Bambang Wijaya','0813 5555 6666','3404xxxxxxxxxxxx','Instagram Ads','Usaha perorangan, baru mulai urus legalitas']
  ];

  -- Per client: daftar (service_type, total_rab, target_status)
  projects_sinar text[][] := array[
    array['PBG Gedung Komersial','4750350000','Proses'],
    array['SLF','3215750000','Baru'],
    array['NIB','3080250000','Selesai'],
    array['Izin Lingkungan (UKL-UPL)','6420175000','Proses'],
    array['Amdal','12650900000','Baru'],
    array['Perpanjangan NIB','3095500000','Selesai']
  ];
  projects_berkah text[][] := array[
    array['Pendirian PT','3150750000','Selesai'],
    array['NPWP Perusahaan','3025250000','Selesai'],
    array['Perubahan Alamat','3340600000','Proses'],
    array['Laporan Tahunan','3180450000','Baru']
  ];
  projects_yayasan text[][] := array[
    array['Pendirian Yayasan','3275800000','Proses'],
    array['NPWP Perusahaan','3050300000','Baru'],
    array['Izin Operasional','4120650000','Baru']
  ];
  projects_global text[][] := array[
    array['Pendirian PT','3225900000','Selesai'],
    array['NIB','3065150000','Selesai'],
    array['Merek Dagang (HKI)','3415700000','Proses'],
    array['SIUP','3090850000','Selesai'],
    array['Izin Usaha','8750300000','Proses'],
    array['BPJS Ketenagakerjaan','3010450000','Selesai'],
    array['Perubahan Pengurus','3185250000','Baru'],
    array['Akta Perubahan Modal','5320600000','Batal'],
    array['Sertifikasi Halal','15750900000','Baru']
  ];
  projects_bambang text[][] := array[
    array['NPWP Perusahaan','3015350000','Selesai'],
    array['Pendirian CV','3650750000','Proses'],
    array['SIUP','3095600000','Baru'],
    array['NIB','3125450000','Baru'],
    array['Merek Dagang (HKI)','3275900000','Baru']
  ];

  all_projects text[][];
  proj_idx int;
  proj_i int;
begin
  -- 1. Insert 5 client baru
  for i in 1..5 loop
    client_ids := array_append(client_ids, gen_random_uuid());
  end loop;

  for i in 1..5 loop
    insert into public.clients
      (id, name, type, npwp, business_field, address, pic_name, pic_title,
       pic_phone, pic_email, director_name, director_phone,
       director_id_number, referral_source, general_notes)
    values (
      client_ids[i],
      new_clients[i][1], new_clients[i][2], new_clients[i][3], new_clients[i][4],
      new_clients[i][5], new_clients[i][6], new_clients[i][7], new_clients[i][8],
      new_clients[i][9], new_clients[i][10], new_clients[i][11], new_clients[i][12],
      new_clients[i][13], new_clients[i][14]
    );
  end loop;

  -- 2. Insert project per client + seed case_stages sesuai target_status
  for proj_idx in 1..5 loop
    if proj_idx = 1 then all_projects := projects_sinar;
    elsif proj_idx = 2 then all_projects := projects_berkah;
    elsif proj_idx = 3 then all_projects := projects_yayasan;
    elsif proj_idx = 4 then all_projects := projects_global;
    else all_projects := projects_bambang;
    end if;

    for proj_i in 1..array_length(all_projects, 1) loop
      v_case_id := gen_random_uuid();

      insert into public.cases (id, client_id, service_type, status, total_rab)
      values (
        v_case_id,
        client_ids[proj_idx],
        all_projects[proj_i][1],
        all_projects[proj_i][3],
        all_projects[proj_i][2]::numeric
      );

      -- Tentukan pola stage sesuai target_status, dengan variasi posisi
      -- "sedang berjalan" untuk status Proses (biar tidak seragam)
      if all_projects[proj_i][3] = 'Selesai' then
        stage_statuses := array['COMPLETED','COMPLETED','COMPLETED','COMPLETED','COMPLETED','COMPLETED'];
      elsif all_projects[proj_i][3] = 'Proses' then
        proses_pos := 2 + floor(random() * 3)::int; -- posisi 2, 3, atau 4
        stage_statuses := array['PENDING','PENDING','PENDING','PENDING','PENDING','PENDING'];
        for i in 1..(proses_pos - 1) loop
          stage_statuses[i] := 'COMPLETED';
        end loop;
        stage_statuses[proses_pos] := 'IN_PROGRESS';
      elsif all_projects[proj_i][3] = 'Batal' then
        stage_statuses := array['COMPLETED','CANCELLED','CANCELLED','CANCELLED','CANCELLED','CANCELLED'];
      else
        stage_statuses := array['PENDING','PENDING','PENDING','PENDING','PENDING','PENDING'];
      end if;

      in_progress_stage_id := null;

      for i in 1..6 loop
        new_stage_id := gen_random_uuid();

        insert into public.case_stages
          (id, case_id, name, order_index, status, owner, started_at, completed_at)
        values (
          new_stage_id,
          v_case_id,
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

      if in_progress_stage_id is not null then
        update public.cases set current_stage_id = in_progress_stage_id where id = v_case_id;
      elsif all_projects[proj_i][3] = 'Selesai' then
        update public.cases c set current_stage_id = cs.id
          from public.case_stages cs
          where cs.case_id = v_case_id and cs.order_index = 6 and c.id = v_case_id;
      elsif all_projects[proj_i][3] = 'Baru' then
        update public.cases c set current_stage_id = cs.id
          from public.case_stages cs
          where cs.case_id = v_case_id and cs.order_index = 1 and c.id = v_case_id;
      end if;

    end loop;
  end loop;
end $$;

commit;
