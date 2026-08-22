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

## [Unreleased] - UI

### Added
- **PROJECT — Part III: Assign Tim (Multi-Internal) UI**. Tab Project
  di Client Detail (`client-detail.js`) sekarang menampilkan daftar
  anggota tim internal per project dari `case_assignees` (tabel yang
  sudah ada di database sejak sebelumnya tapi belum pernah dipakai
  frontend) — berdampingan dengan PIC tunggal (`cases.assigned_to`)
  yang sudah ada, bukan pengganti.
  - admin/supervisor: bisa tambah anggota (pilih dari profil
    `internal`/`supervisor` yang belum jadi anggota project itu, lewat
    menu popover) dan hapus anggota (tombol × pada tiap chip). Sesuai
    RLS (tidak ada policy UPDATE di `case_assignees`), reassign berarti
    hapus baris lama + insert baris baru, bukan update in-place.
  - role `internal`: tampilan read-only, tanpa kontrol tambah/hapus
    (selaras dengan RLS select-only untuk role ini).
  - Setiap tambah/hapus anggota dicatat ke `activities` (mengikuti pola
    `logActivity` yang sudah ada di file yang sama).

## [Unreleased] - Database

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
