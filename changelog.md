# Changelog

Semua perubahan penting pada project ini didokumentasikan di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
dan project ini mengikuti [Semantic Versioning](https://semver.org/).

**Skema versi buat project ini:**
- **MAJOR** (x.0.0) — milestone besar yang koheren, misalnya satu modul penuh
  dari roadmap 10-fitur selesai total.
- **MINOR** (0.x.0) — satu fitur/halaman baru yang bisa dipakai user (biasanya
  1 GitHub Issue = 1 minor bump).
- **PATCH** (0.0.x) — perubahan non-fitur: dokumentasi, konfigurasi, klarifikasi
  aturan kolaborasi, perbaikan kecil yang tidak menambah kapabilitas baru.

---

## [2.12.0] - 2026-08-24

### Added
- **PROJECT — Part V.2: RAB Formal UI** (Issue #62, fase 2/2 — fase 1/2
  adalah trigger `quotation_number`, commit `d079991` di branch yang
  sama, belum pernah dapat entry changelog sendiri karena commit itu
  cuma mengubah file migration, bukan `changelog.md`). Lampiran PRD
  (`SPEC_PROJECT_Part_V2_RAB_Formal.md`), UI untuk skema yang sudah
  dibangun di v2.11.0. Semua perubahan ada di
  `client-quotations.js` (bukan file baru — section "RAB & Penawaran"
  yang sudah ada dari Part V, ditambah bukan dirombak).
  - **Section baru "Detail Pekerjaan"** (`case_quotation_line_items`) —
    tambah/hapus/reorder baris dengan description, detail (sub-line
    opsional), qty, rate, amount (dihitung client-side `qty × rate`,
    read-only, bukan input manual — pola sama seperti total termin di
    Part V). RLS-nya identik `case_quotation_items`: `internal` cuma
    bisa insert/update/delete selama quotation masih DRAFT.
  - **`total_amount` pindah sumber**: sebelumnya SUM dari
    `case_quotation_items` (termin, Part V), sekarang SUM dari
    `case_quotation_line_items` (Detail Pekerjaan). Ditulis di
    `saveQuotationLineItems` — `saveQuotationItems` (termin) tidak lagi
    menulis `total_amount` sama sekali.
  - **Termin jadi alokasi, bukan sumber independen**: saat isi termin,
    ditampilkan total Detail Pekerjaan (dihitung live dari input,
    belum tentu sudah tersimpan) sebagai referensi. Kalau total termin
    ≠ total Detail Pekerjaan, muncul warning non-blocking (banner
    oranye) — dikonfirmasi ke Ray: tidak pernah memblokir tombol "Buat
    Penawaran" karena mismatch ini, cuma indikator visual.
  - **Validasi "Buat Penawaran" diperketat**: sebelumnya cuma cek
    `total_amount > 0`, sekarang itu tetap satu-satunya cek langsung
    tapi secara efektif juga mensyaratkan minimal 1 baris Detail
    Pekerjaan — karena `total_amount` sekarang murni SUM dari baris
    itu dan tiap baris wajib qty>0 & rate>0 buat bisa disimpan, jadi
    total>0 tidak mungkin tercapai tanpa minimal 1 baris valid.
  - **`quotation_number` ditampilkan read-only**: di header draft
    editor ("No. RAB: ..." atau placeholder "akan digenerate otomatis"
    kalau belum ada), di badge ringkas kartu project, dan di tiap baris
    riwayat versi. Frontend tidak pernah menulis kolom ini — murni
    dibaca, sesuai kontrak trigger `generate_quotation_number()`.
  - **`description` auto-generate**: template client-side (bukan
    trigger DB) diisi otomatis saat "Buat RAB Baru" — memakai
    `clients.name`, `clients.pic_name`, `cases.service_type`. Tetap
    editable lewat textarea + tombol "Simpan Deskripsi" sendiri (bukan
    lock, bukan digabung ke save Detail Pekerjaan/Termin).
  - Riwayat versi (panel expand per versi) sekarang juga menampilkan
    Detail Pekerjaan read-only (sebelumnya cuma termin) + description
    versi itu kalau ada — biar versi lama tetap bisa direview lengkap,
    bukan cuma diperbaiki bagian termin-nya.

### Belum diverifikasi manual
- Login OTP masih blocker yang sama seperti Part V — seluruh flow di
  atas cuma direview lewat kode + `npm run lint`/`npm run build`
  (keduanya PASS), belum diklik langsung di browser.
- **Bug ditemukan di trigger `generate_quotation_number()` (commit
  `d079991`, belum di-tag/dirilis), belum diperbaiki**: commit message
  klaim query pewarisan nomor sudah difilter `quotation_number IS NOT NULL` +
  `ORDER BY version`, tapi SQL yang ter-commit di
  `20260824080000_generate_quotation_number_trigger.sql` (baris ~54)
  masih `select quotation_number into existing_number from
  case_quotations where case_id = new.case_id limit 1` — tanpa filter
  maupun order. Untuk case yang punya >1 row lama (misalnya salah
  satunya hasil rekonsiliasi Part II dengan `quotation_number` NULL),
  Postgres bisa memilih row yang salah tanpa `ORDER BY`, sehingga versi
  baru bisa gagal mewarisi nomor yang sudah ada dan malah generate
  nomor baru — melanggar aturan "1 nomor per rangkaian negosiasi
  case_id". Berdampak langsung ke fitur ini karena riwayat versi
  sekarang menampilkan `quotation_number` per versi. Belum diperbaiki
  di sesi ini (perlu migration terpisah, di luar scope UI) — perlu
  keputusan Ray.

---

## [2.9.0] & [2.10.0] - 2026-08-23

_Catatan: entry ini mencakup 2 tag (Part VII dirilis sebagai v2.9.0, Part V sebagai v2.10.0) karena header sempat tidak di-rename di antara keduanya._

### Added
- **PROJECT — Part V: RAB/Penawaran Builder UI**. Section baru "RAB &
  Penawaran" di tiap kartu project pada tab Project (`client-detail.js`),
  logikanya di file baru `client-quotations.js`. Sesuai
  `PRD_Project_Intake_RAB_Workflow_SMA-app.md` §1/§2, independen dari
  pembuatan project (Part VII).
  - Badge status per project (Belum Dibuat / Draft / Menunggu
    Persetujuan / Diterima / Ditolak / Nego / Digantikan), diambil dari
    versi `case_quotations` terbaru (`order by version desc`).
    "Digantikan" (SUPERSEDED) ditangani juga meski secara alur normal
    seharusnya tidak pernah jadi versi terbaru.
  - Modal "RAB & Penawaran" menampilkan riwayat SEMUA versi (bukan cuma
    yang aktif — versi lama tetap bisa dibuka/dilihat rinciannya sesuai
    PRD §7), form rincian termin (`case_quotation_items`) yang bisa
    tambah/hapus/reorder baris dengan total berjalan dihitung di
    client lalu disimpan ke `case_quotations.total_amount`, multi-select
    dokumen wajib dari `document_templates`, dan tombol "Buat
    Penawaran".
  - "Buat RAB Baru" (bikin `case_quotations` versi baru, status DRAFT)
    bisa dilakukan admin/supervisor/internal — cuma muncul kalau belum
    ada draft yang terbuka untuk project itu.
  - "Buat Penawaran" (`case_quotations.status` DRAFT -> SENT +
    `cases.intake_status` -> QUOTED) hanya aktif untuk admin/supervisor,
    sesuai RLS yang sudah diperketat (lihat entry Database di bawah) —
    tombol disembunyikan/disabled untuk `internal` sebagai kejelasan UX
    saja, bukan pengganti RLS. Diblokir juga kalau draft belum punya
    rincian termin (`total_amount` masih 0).
  - Mekanisme multi-select dokumen (dikonfirmasi ke Ray, bukan tebakan):
    centang template -> langsung insert 1 baris ke `documents` (nama =
    nama template, status "Belum"), sama seperti alur manual "+ Tambah
    Dokumen" di `client-documents.js` — bukan ditunda sampai klik "Buat
    Penawaran". Cek dulu supaya tidak duplikat nama dokumen yang sudah
    ada untuk case itu. Uncheck cuma menghapus baris kalau statusnya
    masih "Belum"; kalau sudah "Upload"/"Terverifikasi"/"Ditolak",
    checkbox dikunci (disabled) + keterangan status supaya tidak ada
    riwayat upload client yang kehapus tidak sengaja.
  - Akses tulis ke `documents` dari checkbox ini disamakan dengan aturan
    `client-documents.js` yang sudah ada: admin+internal saja,
    `supervisor` sengaja TIDAK diikutkan (mengikuti pembatasan tabel
    `documents` yang sudah ada, bukan pola "supervisor = admin" yang
    berlaku di tabel lain).
  - Log ke `activities`: pembuatan RAB baru ("Buat RAB") dan pengiriman
    penawaran ("Kirim Penawaran"). Edit rincian termin & centang
    dokumen sengaja TIDAK di-log (menyamakan pola `client-documents.js`
    yang juga tidak log insert dokumen manual, cuma log perubahan
    status).

### Changed
- **PROJECT — Part VII: Wizard Tambah Project (versi ringan)**. Sesuai
  `PRD_Project_Intake_RAB_Workflow_SMA-app.md` §1/§2.1 — Project & RAB
  sekarang 2 section independen, bukan 1 wizard. Modal "+ Tambah
  Project" (`case-form.js`) dirombak jadi persis 4 field "Info
  Project", tanpa field RAB/dokumen sama sekali:
  - **Project Creator** — read-only, auto-terisi dari profil user yang
    login, jadi `cases.created_by` saat simpan (kolomnya sudah ada
    sejak Part III).
  - **Jenis layanan** (`cases.service_type`) — tetap dropdown, tidak
    diubah polanya.
  - **Tambah Team** (`case_assignees`) — reuse pola chip
    tambah/hapus dari tab Project (Part III). Kontrol tambah/hapus
    cuma muncul untuk admin/supervisor, sama seperti aturan
    post-creation — RLS `case_assignees` tidak beda perlakuan
    "saat bikin baru" vs "project sudah ada", jadi aturannya memang
    identik, bukan tebakan. Role `internal` lihat catatan bahwa tim
    baru bisa ditambahkan setelah project dibuat.
  - **Deskripsi** (`cases.notes`) — field ini ternyata sudah ada di
    form lama (berlabel "Catatan"), tinggal di-relabel, tidak perlu
    field baru.
  - Dihapus dari form: field **RAB** (`total_rab`, keluar scope —
    itu section "RAB & Penawaran" terpisah, Part V) dan field **PIC**
    (`assigned_to`) yang sebelumnya sengaja belum disentuh saat Part
    III (lihat catatan v2.7.0) — sekarang baru dihapus total dari form
    pembuatan project sesuai keputusan final PRD.
- Setelah project baru tersimpan, list project di tab Project sekarang
  otomatis refresh tanpa reload halaman (`onCreated` callback) — tab
  Project sebelumnya butuh reload manual buat lihat project yang baru
  dibuat.

### Belum diverifikasi manual
- Login OTP butuh akses email yang tidak tersedia buat AI agent (sama
  seperti blocker di Part III) — flow ini belum dicoba end-to-end di
  browser sungguhan, cuma direview lewat kode + `npm run lint`/`npm run
  build`. `cases.total_rab` dikonfirmasi nullable (dicek dari `\d+
  cases` di sesi sebelumnya, tidak ada constraint NOT NULL), jadi
  insert `cases` tanpa kolom itu aman. Yang masih perlu dicek manual di
  browser: insert `case_assignees` batch saat ada anggota tim dipilih
  sebelum project disimpan, dan verifikasi visual form secara umum.
- **Part V (RAB/Penawaran Builder)**: login OTP masih blocker yang sama
  persis, jadi seluruh flow di atas cuma direview lewat kode +
  `npm run lint`/`npm run build` (keduanya PASS), belum diklik langsung
  di browser. Yang paling perlu dicek manual duluan begitu login bisa
  dicoba:
  - Apakah `DELETE` ke `documents` benar-benar diizinkan RLS untuk
    admin/internal — sepanjang codebase ini, `documents` cuma pernah
    di-`insert`/`update` (`client-documents.js`), belum pernah
    di-`delete` sama sekali, jadi ini request DELETE pertama ke tabel
    itu dari frontend. Kalau RLS-nya ternyata belum mengizinkan, UI
    sudah menangani dengan aman (toast error + checkbox di-uncheck
    balik, tidak silent/crash), tapi fitur "uncheck buat hapus dokumen
    Belum" itu sendiri tidak akan berfungsi sampai RLS-nya ditambahkan.
  - Apakah `UPDATE cases.intake_status` benar-benar diizinkan RLS untuk
    `supervisor` (bukan cuma `admin`/`internal` yang sudah terbukti
    lewat fitur update status project yang sudah ada) — kalau tidak,
    "Buat Penawaran" oleh supervisor akan tetap berhasil mengubah
    `case_quotations.status` jadi SENT (RLS untuk tabel itu sudah pasti
    mengizinkan) tapi gagal di update `cases.intake_status`, dan UI
    sudah menampilkan toast peringatan terpisah untuk kasus ini
    (bukan silent failure).
  - Delete-then-insert saat "Simpan Rincian Termin" (bukan update
    in-place per baris) — dipilih supaya tidak kena unique constraint
    `(quotation_id, order_index)` saat reorder, tapi berarti ada jeda
    singkat di mana baris lama sudah terhapus sebelum baris baru
    ke-insert; kalau network putus persis di jeda itu, rincian termin
    bisa hilang dari DB (form di browser tetap menyimpan datanya untuk
    di-retry-simpan). Belum pernah teruji di kondisi network nyata.
  - Query `case_quotations` yang embed `profiles!created_by` sudah
    pakai hint FK eksplisit dari awal (mengikuti pola fix di v2.7.0),
    tapi belum bisa dikonfirmasi jalan di browser sungguhan.

## [2.11.0] - 2026-08-24

_Catatan: header ini sempat tertinggal sebagai "[Unreleased] - Database" walau tag `v2.11.0` sudah dibuat saat merge — direname supaya konsisten dengan tag git, pola yang sama seperti fix header 2.8.0/2.9.0/2.10.0 di atas._

### Added
- **PROJECT — Part V.2: RAB Formal (schema)**. Lampiran PRD
  (`SPEC_PROJECT_Part_V2_RAB_Formal.md`), bukan revisi Part V —
  penambahan. `case_quotation_items` (termin pembayaran, Part V) tetap
  dipakai, tidak diubah.
  - Tabel baru `service_type_codes` — mapping `service_type` ke kode
    3 huruf untuk nomor RAB (format `SMA/YYYY-MM/{kode}/{urutan}`),
    di-seed 21 kode. Admin manage, supervisor/internal select-only,
    tidak ada akses client (tabel konfigurasi internal).
  - Tabel baru `case_quotation_line_items` — rincian pekerjaan
    (description, detail, qty, rate, amount, order_index) — BEDA dari
    `case_quotation_items` (termin pembayaran). RLS identik dengan
    `case_quotation_items`: admin ALL, supervisor setara, internal
    dibatasi ke quotation berstatus DRAFT, client SELECT-only.
  - Kolom baru `case_quotations.quotation_number` dan
    `case_quotations.description`.
  - Belum ada logic generate nomor RAB (trigger/function) atau
    perubahan frontend — task terpisah setelah ini.
- Diverifikasi ke database: 21 kode layanan masuk, tabel
  `case_quotation_line_items` ada, 2 kolom baru ada di `case_quotations`.

## [2.8.0] - 2026-08-22

_Catatan: section "Fixed" di bawah (RLS case_quotations) sebenarnya bagian dari pekerjaan v2.10.0/Part V, tercampur di sini karena header sempat tidak di-rename. Section "Added" (Part IV) adalah isi asli v2.8.0._

### Fixed
- **RLS `case_quotations`/`case_quotation_items` diperketat untuk
  `internal`** — migration
  [`20260823050000_project_part5_tighten_quotation_rls.sql`](supabase/migrations/20260823050000_project_part5_tighten_quotation_rls.sql).
  Policy `internal_insert`/`internal_update` yang lama (dari Part I)
  mengizinkan `internal` insert/update `case_quotations` tanpa batasan
  status sama sekali — bertentangan dengan PRD §4 ("hanya
  admin/supervisor yang boleh mengubah status jadi SENT"). Sekarang
  `internal` cuma bisa insert/update baris yang statusnya (baik lama
  maupun baru) tetap `DRAFT`; `case_quotation_items` ikut dibatasi
  lewat `exists` join ke `case_quotations.status = 'DRAFT'` (termasuk
  policy delete-nya, yang sebelumnya juga tidak dibatasi).
  admin/supervisor tidak berubah (tetap tanpa batasan status, pola yang
  sama dengan `payments_internal_insert`/`update` dan trigger
  `profiles_prevent_privilege_escalation` yang sudah ada). Ditulis
  sebelum UI builder (Part V) dibangun supaya proteksinya di level DB,
  bukan cuma disembunyikan di tombol UI.

### Added
- **PROJECT — Part IV: Seed Data Awal Document Templates**. 15
  dokumen umum (KTP, NPWP, NIB, Akta, dll) di-seed ke
  `document_templates` (tabel sudah ada dari Part I), dikelompokkan
  per kategori (Identitas, Legalitas, Teknis, Keuangan), dengan
  `default_service_types` untuk auto-suggest di form RAB (Part V).
  Bukan halaman kelola master dokumen — itu fitur terpisah, ditunda.
- Diverifikasi: 15 baris masuk (3 Identitas, 1 Keuangan, 9 Legalitas,
  2 Teknis).

## [2.7.0] - 2026-08-22

### Added
- **PROJECT — Part III: Assign Tim (Multi-Internal) UI**. Tab Project
  di Client Detail (`client-detail.js`) sekarang menampilkan daftar
  anggota tim internal per project dari `case_assignees` (tabel yang
  sudah ada di database sejak sebelumnya tapi belum pernah dipakai
  frontend).
  - admin/supervisor: bisa tambah anggota (pilih dari profil
    `internal`/`supervisor` yang belum jadi anggota project itu, lewat
    menu popover) dan hapus anggota (tombol × pada tiap chip). Sesuai
    RLS (tidak ada policy UPDATE di `case_assignees`), reassign berarti
    hapus baris lama + insert baris baru, bukan update in-place.
  - role `internal`: tampilan read-only, tanpa kontrol tambah/hapus
    (selaras dengan RLS select-only untuk role ini).
  - Setiap tambah/hapus anggota dicatat ke `activities` (mengikuti pola
    `logActivity` yang sudah ada di file yang sama).
- **Kolom `cases.created_by`** ("Project Creator") — migration
  [`20260822230000_add_cases_created_by.sql`](supabase/migrations/20260822230000_add_cases_created_by.sql).
  Tampilan PIC (`cases.assigned_to`) di card Project dihapus total dan
  diganti field read-only "Dibuat oleh" yang membaca `created_by`.
  `assigned_to`, trigger `cases_prevent_internal_pic_reassignment`, dan
  kode lain yang menulis ke `assigned_to` (mis. `case-form.js` saat
  bikin project baru) SENGAJA tidak disentuh — cuma berhenti
  ditampilkan di tab ini. 43 case existing direkonsiliasi retroaktif
  ke satu-satunya admin (Ray) di sistem selama data itu dibuat.

### Fixed
- **Query `case_assignees`/`cases` yang embed `profiles` gagal
  (`Gagal memuat tim`)**: `case_assignees` punya dua FK ke `profiles`
  (`user_id` dan `assigned_by`), begitu juga `cases` sekarang punya dua
  (`assigned_to` dan `created_by`), jadi PostgREST menolak resolve
  embed tanpa hint eksplisit ("more than one relationship was found").
  Disambiguasi dengan hint kolom FK langsung, mis.
  `profiles!user_id(...)` dan `profiles!created_by(...)`. Root cause
  yang sama ini juga yang bikin chip tim tidak ter-update setelah
  tambah anggota berhasil (reload-nya diam-diam gagal dengan error
  yang sama, bukan bug rendering terpisah).

## [2.6.0] - 2026-08-22

### Added
- **PROJECT — Part II: Rekonsiliasi Data Existing**. 42 case yang
  sudah punya `case_stages` (dari seeding sebelum alur intake/RAB
  dibangun) direkonsiliasi retroaktif: `intake_status` diset
  `ACCEPTED`, ditambahkan 1 `case_quotations` dummy (status ACCEPTED)
  + 1 `case_quotation_items` generik (rincian termin asli tidak
  tercatat di data lama, dicatat apa adanya sebagai keterbatasan).
- 1 case ("Tau Bbanget" — SLF, hasil testing manual, tidak punya
  `case_stages`) sengaja TIDAK direkonsiliasi, tetap `DRAFT` — sesuai
  kriteria, bukan pengecualian khusus.
- Diverifikasi: 42 ACCEPTED, 1 tetap DRAFT, 42 case_quotations dibuat.

## [2.5.0] - 2026-08-22

### Added
- **PROJECT — Part I: Schema Foundation**. Fondasi untuk fitur besar
  "PROJECT — Intake & RAB Workflow" (7 part, lihat
  `PRD_Project_Intake_RAB_Workflow_SMA-app.md`):
  - `document_templates` — master jenis dokumen (admin manage,
    supervisor/internal select-only, tidak ada akses client)
  - `case_quotations` — RAB/penawaran header, versioned
    (DRAFT/SENT/ACCEPTED/REJECTED/NEGOTIATING/SUPERSEDED). Client
    SELECT-only — akses tulis (Terima/Tolak/Nego) ditunda ke Part VI
  - `case_quotation_items` — rincian termin per quotation
  - Kolom baru `cases.intake_status`
    (DRAFT/QUOTED/ACCEPTED/REJECTED, default DRAFT)
- Seluruh 43 case existing dapat `intake_status = 'DRAFT'` dari
  default kolom — akan direkonsiliasi ke `ACCEPTED` di Part II
  (belum dikerjakan) karena sudah punya `case_stages`/sedang berjalan.
- Catatan: ditemukan 1 case baru ("Tau Bbanget" — SLF) yang tidak
  berasal dari seeding manapun, kemungkinan hasil testing manual —
  perlu diklarifikasi sebelum Part II (apakah ikut direkonsiliasi
  atau dihapus).

## [2.4.0] - 2026-08-22

### Added
- **Sync otomatis `cases.status` dari `case_stages`**: keputusan final
  PRD_Workflow_Layer_SMA-app.md §4 poin 3 — status lama TIDAK
  digantikan, tapi dihitung ulang otomatis lewat trigger setiap kali
  ada perubahan status di `case_stages`, berdasarkan kondisi SEKARANG
  (bukan progress tertinggi yang pernah dicapai) — mendukung kasus
  revisi/mundur stage yang sering terjadi. `status = 'Batal'` dilindungi,
  tidak pernah ditimpa otomatis (murni keputusan manual).
- Diverifikasi lewat transaction test langsung ke database (ROLLBACK,
  tidak ada perubahan data production): insert stage PENDING -> Baru,
  update ke COMPLETED -> Selesai, Batal manual tetap bertahan meski
  stage diubah balik ke PENDING.
- Supervisor untuk role management (belum ada aksi teknis — masih
  1 user di sistem): Ray tetap `admin`, Tomy akan jadi `supervisor`
  begitu ada mekanisme invite (roadmap #10 atau manual via SQL).

## [2.3.0] - 2026-08-22

### Changed
- **Revert & rebuild Workflow Layer**: Task #33 (generic workflow-engine:
  `workflow_templates`, `workflow_template_stages`, `workflow_instances`,
  `workflow_stages`) sudah di-drop. Ternyata `PRD_Workflow_Layer_SMA-app.md`
  (v1.0, 21 Agustus 2026, dibuat setelah `SMA_APP_MASTER_ARCHITECTURE.js`,
  hasil diskusi lanjutan) sudah menolak pendekatan generic-engine dan
  memilih desain lebih ramping. File PRD ini sempat tidak terbaca sebelum
  Task #33 dieksekusi.
- Dibangun ulang sesuai PRD §2: tabel `case_stages` (daftar tahap per
  case, bisa diedit bebas), kolom `cases.current_stage_id`, tabel
  `document_versions` (riwayat versi dokumen, `rejection_reason` wajib
  kalau status Ditolak), perluasan `payments` (kolom
  `invoice_number`/`invoice_issued_at`/`receipt_number`/`receipt_issued_at`).
- Ditambahkan trigger `payments_prevent_invoice_receipt_tampering` —
  hanya admin/supervisor boleh mengubah kolom invoice/receipt (celah
  sama seperti yang ditutup di `profiles` pagi ini, ditutup proaktif).
- `cases.status` (Baru/Proses/Selesai/Batal) TIDAK diubah — hubungannya
  dengan `case_stages` masih open question (PRD §4 poin 3).
- Asumsi yang perlu dikonfirmasi: RLS `document_versions` untuk role
  `supervisor` disamakan dengan `admin` (PRD tidak menyebutkan
  `supervisor` secara eksplisit untuk tabel ini).

## [2.1.2] - 2026-08-22

### Added
- **Skema inti workflow engine** (`workflow_templates`,
  `workflow_template_stages`, `workflow_instances`, `workflow_stages`) —
  migration
  [`20260822150000_create_workflow_engine_core_schema.sql`](supabase/migrations/20260822150000_create_workflow_engine_core_schema.sql).
  `workflow_instances` di-link ke `cases` lewat `case_id`. RLS mengikuti
  pola `cases`/`case_assignees` (admin ALL, supervisor/internal
  select+write sesuai peran), plus policy client select-own tambahan pada
  `workflow_instances`/`workflow_stages` (deviasi disengaja dari
  `case_assignees` yang tidak punya policy client sama sekali) karena
  arsitektur workflow mensyaratkan client bisa lihat progress project
  mereka. Issue #33. **Schema-only** — belum ada `workflow_actions`/
  `workflow_transitions` (task terpisah) dan belum disambungkan ke
  frontend/`client-workflow.js` sama sekali.

### Fixed
- **RLS `profiles`**: menutup celah self-role-escalation — sebelumnya
  policy `profiles_self_update` cuma membatasi baris (`auth.uid() = id`)
  tanpa membatasi kolom, sehingga user non-admin secara teknis bisa
  mengubah `role`/`client_id` di profil sendiri lewat query langsung.
  Ditambahkan trigger `profiles_prevent_privilege_escalation` yang
  memblokir perubahan `role`/`client_id` kecuali oleh `admin`.
- Perubahan dijalankan manual via psql (Session Pooler), bukan lewat
  file migration/Issue/PR — didokumentasikan retroaktif lewat entry ini.

### Notes (verifikasi manual terhadap skema real)
- Tabel `case_assignees` (multi-assignee per project) dan role
  `supervisor` di constraint `profiles.role` **sudah ada di database**
  dari sesi kerja sebelumnya (belum sempat terdokumentasi resmi).
  Sudah diverifikasi:
  - Trigger `cases_prevent_internal_pic_reassignment` sudah membatasi
    reassign PIC dari sisi `internal` di level DB, bukan cuma UI.
  - RLS `documents`/`payments` sudah membedakan hak `internal` (dibatasi
    status) vs `supervisor` (bebas verifikasi dokumen & tandai lunas),
    sesuai PRD User & Role Management.
  - `case_assignees` **belum dipakai di frontend sama sekali** — kode
    (`case-form.js`, `client-detail.js`) masih murni pakai kolom lama
    `cases.assigned_to` (single PIC). Backend sudah siap, UI belum
    disambungkan — bukan tabel usang, tapi fitur yang belum dibangun.
  - Role `supervisor` **belum ada satupun referensinya di frontend**
    (dropdown role, menu, dsb).

### Open questions
- Siapa dari 5 staf internal yang naik jadi `supervisor` — belum
  diputuskan, bukan blocker untuk merge dokumentasi ini.
- Kapan `case_assignees` mulai disambungkan ke UI (multi-assignee per
  project) — belum ada Issue-nya.

## [2.1.1] - 2026-08-22

### Fixed
- Token CSS salah di tab Workflow (`--surface`, `--surface-muted`,
  `--text-primary`, `--radius-md` tidak terdefinisi di `_tokens.scss`)
  menyebabkan styling berpotensi tidak muncul di browser meski lint &
  build PASS. Diganti ke token yang benar. Issue #29.

## [2.1.0] - 2026-08-22

### Added
- **Tab Workflow** pada Client Detail — UI workflow per project dengan pemilihan project, progress 6 tahap, current responsibility, detail stage, completion conditions, dan ringkasan dokumen. Issue #27.
- Workflow dibuat sebagai **UI prototype** dengan dummy data; belum terhubung ke Supabase atau melakukan database mutation.

## [2.0.0] - 2026-08-20

**Milestone: Modul Client Management (roadmap item #2 dari 10) LENGKAP.**
Semua 9 issue asli (#2-#10) plus 1 issue tambahan (#22) closed. Aplikasi
sekarang punya siklus penuh: Client List -> Tambah Client -> Detail Client
(5 tab: Info, Project, Dokumen, Pembayaran, Aktivitas) -> Tambah
Project/Case -> checklist dokumen -> tracking pembayaran -> feed aktivitas
gabungan manual + auto-log.

### Added (sejak v1.7.2)
- **Tab Dokumen** (`src/v4/client-documents.js`) — checklist dokumen
  dikelompokkan per project, modal Tambah Dokumen, status Belum/Upload/
  Terverifikasi/Ditolak, validasi URL http/https, akses dibatasi
  admin+internal, auto-log ke `activities`. Issue #8 closed, PR
  [#19](../../pull/19). Dikerjakan Dimas.
- **Tab Pembayaran** (`src/v4/client-payments.js`) — ringkasan Total RAB /
  Total Dibayar / Sisa Piutang, form Tambah Termin (DP/Pelunasan), validasi
  nominal positif, aksi Tandai Lunas, role-based access (client read-only
  sesuai RLS), auto-log ke `activities`. Issue #9 closed, PR
  [#20](../../pull/20). Dikerjakan Dimas.
- **Tab Aktivitas** (`src/v4/client-activities.js`) — feed kronologis
  gabungan manual + auto-log (Status Project, Reassign PIC, Status
  Dokumen, Status Pembayaran), form Catat Aktivitas manual, project
  opsional di entry manual, fallback handling utk profile/project null.
  Issue #10 closed, PR [#21](../../pull/21). Dikerjakan Dimas.
- Semua tab baru: loading state, empty state, error state, access-denied
  state, lazy-load module idempotent — konsisten satu pola di seluruh app.

### Fixed
- **Status Project sekarang interaktif** — sebelumnya badge status
  ambigu (gak jelas bisa diklik atau nggak), diganti jadi native
  `<select>` dengan chevron, tetap pakai warna existing per status, touch
  target nyaman desktop+mobile, accessible name unik untuk project dengan
  nama sama, conditional update (cegah stale/race condition), rendering
  card dipindah ke DOM API/textContent (bukan innerHTML). Issue #22
  closed, PR [#23](../../pull/23). Dikerjakan Dimas — issue ini dia buat
  sendiri sebagai follow-up dari QA Issue #10.

### Known follow-up (belum dikerjakan)
- Issue [#24](../../issues/24) — status dokumen belum otomatis sinkron
  sama keberadaan link (harusnya: gak ada link -> "Belum", ada link ->
  "Upload" otomatis, bukan manual dua langkah).

---

## [1.7.2] - 2026-08-20

### Changed
- Relabel UI tersisa dari Case ke Project: dashboard Overview dan Client List.

---

## [1.7.1] - 2026-08-20

### Fixed
- `src/v4/client-form.js` (defensive): UUID client baru di-generate di
  browser sebelum insert, tidak lagi bergantung pada baca-balik
  pasca-insert. Issue #15 closed, PR [#18](../../pull/18).

---

## [1.7.0] - 2026-08-20

### Added
- Tab Project: dropdown ubah status + reassign PIC (role-gated), auto-log
  ke `activities`. Issue #6 closed, PR [#17](../../pull/17).

---

## [1.6.0] - 2026-08-20

### Added
- Form Tambah Case/Project Baru. Issue #7 closed, PR [#16](../../pull/16).

### Fixed
- Bug toast error palsu pasca-insert case yang sebenarnya sukses.

---

## [1.5.0] - 2026-08-20

### Added
- Form Tambah Client Baru, redirect ke Detail Client. Issue #5 closed, PR [#14](../../pull/14).

---

## [1.4.0] - 2026-08-20

### Added
- Client Detail shell 5-tab + Tab Info (read/edit). Issue #4 closed, PR [#13](../../pull/13).

---

## [1.3.0] - 2026-08-19

### Added
- Kolom identitas & kontak lengkap di tabel `clients`. Issue #3 closed, PR [#12](../../pull/12).

---

## [1.2.0] - 2026-08-19

### Added
- Client List — tabel, search, filter. Issue #2 closed, PR [#11](../../pull/11).

---

## [1.1.1] - 2026-08-19

### Added
- CLAUDE.md stub yang menunjuk ke AGENTS.md.

---

## [1.1.0] - 2026-08-19

### Added
- AGENTS.md, PRD_Client_Management_SMA-app.pdf, 9 GitHub Issues (#2-#10), GitHub Project board.

### Infrastructure
- Dimas diundang collaborator (akses Write). Branch protection main diaktifkan.

---

## [1.0.0] - 2026-08-19

Rilis fondasi pertama.

### Added
- Base project Gentelella v4, rebrand "Soul Mitra Abadi"
- Skema database Supabase awal + RLS 3 role
- Auth magic-link/OTP invite-only
- Dashboard Overview dengan query real
- Seed data dummy

### Infrastructure
- Repo GitHub soulmediaglobal/sma-app dibuat
- Akun baru: GitHub, Supabase, Resend

---

## Catatan tambahan (non-versioned, housekeeping)

- **2026-08-20**: Assignee Issue #3, #6, #7 dikoreksi ke `soulmediaglobal`.
- **2026-08-20**: Login diperbaiki — Magic Link jadi kode OTP, panjang kode disamakan 8->6 digit.
- **2026-08-20**: Judul Issue #6, #8, #9 diupdate ke istilah "Project".
- **2026-08-20**: Verifikasi cross-review PR #19/#20/#21/#23 — konfirmed semuanya di-approve `soulmediaglobal` sesuai proses (bukan bypass), Dimas hanya punya akses `write` (bukan admin/maintain).

[Unreleased]: https://github.com/soulmediaglobal/sma-app/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.7.2...v2.0.0
[1.7.2]: https://github.com/soulmediaglobal/sma-app/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/soulmediaglobal/sma-app/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/soulmediaglobal/sma-app/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/soulmediaglobal/sma-app/releases/tag/v1.0.0
