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

## [Unreleased] - App

### Changed
- **Issue #119: Konsolidasi profile.html ke user_detail.html.**
  `production/profile.html` dihapus total — user_detail.html sekarang
  satu-satunya halaman untuk lihat/edit info user, mode ditentukan dari
  perbandingan `?id=` di URL dengan ID user yang login:
  - Tanpa `?id=` (atau `?id=` sama dengan ID sendiri) → mode "profil
    sendiri"
  - `?id=` beda + viewer admin/supervisor → mode "kelola user lain"
  - Menu sidebar berbasis role: admin/supervisor tampil "User
    Management" (tidak lagi "Profil Saya" — akses profil sendiri lewat
    User Management), internal/client tampil "Profil Saya" (mengarah
    ke user_detail.html tanpa `?id=`)
  - `src/v4/profile.js` disederhanakan — hanya menyisakan
    `updateProfile()` yang dipakai bersama oleh user-detail.js, seluruh
    fungsi khusus halaman lama (loadProfile, saveProfile,
    saveNotifications, dll) dihapus
- **Role field kini bisa diedit untuk admin/supervisor.** Sebelumnya
  (Issue #113) role dikunci read-only karena khawatir lockout — proteksi
  itu sudah ada di level database sejak Issue #109 (trigger menolak
  kalau perubahan akan menyisakan 0 admin aktif), jadi penguncian di UI
  tidak diperlukan lagi untuk role admin/supervisor. Role tetap
  read-only untuk internal/client (mereka tidak berwenang mengubah role
  siapapun, termasuk diri sendiri).
- Email dan Company/Position/Bio TETAP read-only permanen — Email
  disinkron dari `auth.users` (butuh alur verifikasi terpisah, bukan
  UPDATE biasa), Company/Position/Bio karena kolomnya belum ada di
  schema (keputusan Issue #115, tidak menambah schema tanpa kebutuhan
  jelas).
- Diverifikasi VISUAL langsung di browser oleh Ray: menu "Profil Saya"
  hilang untuk admin, klik dari sidebar (tanpa `?id=`) menampilkan data
  sendiri dengan benar, Role sekarang jadi dropdown yang bisa diedit
  dan disimpan.

## [2.23.0] - 2026-08-25

### Fixed
- **Issue #113: Koreksi struktur teknis halaman Profile & User Detail**.
  `production/profile.html` dan `production/user_detail.html` (redesign
  visual dari Gemini) punya 4 masalah struktural yang menyimpang dari
  konvensi codebase — desain visualnya dipertahankan 100%, cuma
  strukturnya yang dibetulkan:
  - Kedua halaman pakai pola SPA (`<div id="app">` kosong + tanpa
    `<script type="module" src="/src/main-v4.js">` di `<head>`) alih-alih
    static HTML + main-v4.js yang dipakai semua halaman lain. Dibalikin
    ke pola yang benar, plus `data-shell="admin"` supaya sidebar/topbar
    ke-inject dan `guardAdminPage()` jalan (redirect ke login kalau belum
    ada sesi) — sebelumnya kedua halaman ini ke-render tanpa shell/guard
    sama sekali.
  - Logic yang tadinya inline `<script type="module">` di body dipindah
    ke `src/v4/profile.js` (`initProfile()`) dan `src/v4/user-detail.js`
    (`initUserDetail()`, file baru) — masing-masing di-lazy-import dari
    `main-v4.js` dengan DOM-presence guard, sama seperti
    `client-detail.js`/`project-setting.js`.
  - `src/v4/profile.js` (dan inline script `profile.html` yang lama)
    bikin instance Supabase client sendiri lewat `createClient(...)`.
    Diganti pakai `supabase` singleton dari `src/lib/supabaseClient.js`
    yang dipakai seluruh app.
  - Kedua halaman ini load `bootstrap-icons` dari CDN — stack project ini
    eksplisit tidak pakai Bootstrap. Semua `<i class="bi bi-...">`
    diganti inline SVG (ikon boleh tidak identik, cuma dependensi CDN-nya
    yang dihapus).
  - `uploadAvatar()` + tombol "Change avatar" dihapus dari
    `profile.html`/`profile.js` — kolom `profiles.avatar_url` belum ada
    di schema (diverifikasi: id, role, name, client_id, created_at,
    phone, last_sign_in_at, last_login_device, full_name, email,
    account_status, status_changed_at, status_changed_by,
    status_reason). Ditinggalkan komentar di kode bahwa fitur ini butuh
    migration + Supabase Storage bucket baru sebelum bisa diaktifkan
    lagi. Logic tampilan avatar (fallback ke gambar generated dari nama)
    tetap dipertahankan di kedua halaman.
  - File backup nyasar (`profile.html.bak`, `user_detail.html.bak`,
    `user_detail.html.dom-backup`, `user-management.js.bak`) dihapus —
    bukan bagian dari konvensi file project ini.
  - **Bug lanjutan ditemukan Ray setelah login**: sidebar overlap ke
    konten dan tidak bisa di-toggle. Root cause: kedua halaman masih
    pakai wrapper `<main class="main-content" id="mainContent">` —
    nama class sisa dari redesign SPA yang tidak nyambung ke CSS
    layout sidebar yang sebenarnya. Dibetulkan ke wrapper yang dipakai
    semua halaman lain, `<main class="main"><div class="page-wrapper">`
    (persis pola `client-detail.html`). Konten/card di dalamnya tidak
    diubah. Selector CSS `body[data-page="user_detail"] .main-content`
    di `<style>` override `user_detail.html` juga disesuaikan ke `.main`
    supaya background gelapnya tidak hilang. `id="mainContent"` sudah
    dicek tidak direferensikan di `profile.js`/`user-detail.js`.
  - **2 masalah lagi ditemukan Ray setelah login berhasil** (sidebar
    sudah confirmed OK):
    1. Tombol "Manage Account" muncul dobel di `user_detail.html` (di
       card profil kiri DAN di footer form kanan) — sekarang footer
       form kanan diganti jadi tombol "Simpan" yang fungsional (lihat
       poin 2), card kiri tetap pakai "Manage Account" (link ke
       `user_management.html`, beda fungsi). Header atas ("Cancel" +
       "Manage Account") tidak diubah, tidak termasuk yang dilaporkan
       dobel.
    2. Form "Personal information" di `user_detail.html` full visual
       saja — field `detailInfoName`/`detailInfoPhone` cuma `<div>`,
       bukan `<input>`, dan tidak ada satupun tombol yang benar-benar
       nyimpan. Dicek ulang schema `profiles` lewat
       `supabase/migrations/*.sql` (bukan asumsi): kolom yang beneran
       ada & bisa diedit user cuma `full_name` dan `phone`. Kolom
       `company`/`position`/`bio` TIDAK ADA di schema — field-field ini
       tetap ditampilkan read-only ("-") dengan komentar HTML yang
       menjelaskan kenapa. `role` sengaja tetap read-only juga: trigger
       `prevent_profile_privilege_escalation` cuma izinin admin/
       supervisor ubah role, dan halaman ini belum ada UI konfirmasi/
       proteksi last-admin-lockout untuk itu — di luar scope perbaikan
       ini.
       - `detailInfoName`/`detailInfoPhone` diganti jadi `<input>`
         beneran (CSS `.ud-form-input` ditambah secukupnya biar
         tampilannya tetap konsisten sama field read-only di
         sebelahnya).
       - Tombol "Simpan" manggil `updateProfile()` — diimpor dari
         `src/v4/profile.js` (di-`export`, dipakai bareng, bukan
         disalin ulang) — cuma kirim `{ full_name, phone }`.
       - Tombol "Discard" reset kedua field ke nilai terakhir yang
         berhasil di-load (state di memory), bukan reload halaman.
       - Sukses/gagal simpan ditampilkan lewat `showToast()`
         (`src/v4/toast.js`) — pola yang sama dipakai
         `project-setting.js`, bukan bikin cara baru.
       - **Catatan buat Ray**: `src/v4/profile.js` (halaman
         `profile.html`, punya user sendiri) masih kirim `company` dan
         `bio` ke `updateProfile()` juga — dua kolom itu SAMA-SAMA tidak
         ada di schema, jadi setiap klik "Save changes" di
         `profile.html` kemungkinan besar sudah gagal dari awal (error
         "column does not exist"). Belum disentuh di commit ini karena
         di luar scope yang diminta (cuma `user_detail.html`) —
         di-flag di sini biar tidak kelewat, perlu diputuskan
         terpisah apakah mau dibetulkan dengan pola yang sama
         (disable + comment, seperti avatar upload) atau kolomnya
         ditambah lewat migration baru.
  - **2 hotfix lagi dari Ray** setelah form Save/Discard confirmed jalan:
    1. **Konsistensi bahasa — DEVIASI SENGAJA, BACA INI SEBELUM UBAH
       BAHASA HALAMAN INI.** Konvensi normal project ini: semua teks UI
       pakai Bahasa Indonesia. `profile.html` dan `user_detail.html`
       DIKECUALIKAN dari aturan itu atas permintaan eksplisit Ray —
       khusus 2 halaman ini distandardkan ke **English penuh** karena
       redesign Gemini aslinya sudah sebagian besar Inggris dan Ray
       memilih konsistensi-dalam-halaman itu ketimbang menerjemahkan
       ulang semuanya ke Indonesia. **Jangan "dibetulkan" balik ke
       Indonesia tanpa konfirmasi Ray, dan jangan jadikan ini preseden
       untuk halaman lain** — dicatat juga sebagai komentar
       `LANGUAGE NOTE` di `<head>` kedua file HTML dan di kepala
       `profile.js`/`user-detail.js`. Yang dibetulkan: tombol "Simpan"
       (sisa dari hotfix sebelumnya) → "Save"; toast Indonesia di
       `user-detail.js` → English; `alert()` di `profile.js`
       (ternyata juga campur — belum kelihatan sebelumnya karena ada
       di JS, bukan di HTML) → English; `<html lang="id">` → `lang="en"`
       di kedua file (representasi bahasa konten yang benar).
    2. **Field editable vs read-only kelihatan identik.** Sekarang
       `.ud-form-value` (dipakai semua field non-input) defaultnya
       tampil sebagai state read-only: `background: var(--bg-surface-
       secondary)`, `color: var(--text-muted)`, `cursor: not-allowed`,
       plus glyph 🔒 kecil via `::after` (otomatis tidak muncul di
       `<input>` karena browser tidak render generated content di situ
       — tidak perlu selector pengecualian terpisah). Field Role tetap
       pakai chevron ⌄ yang sudah ada (urutan CSS-nya sengaja
       ditumpuk setelah aturan lock supaya menang). `.ud-form-input`
       (2 field beneran editable: `detailInfoName`/`detailInfoPhone`)
       di-override ke tampilan input standar: `background: var(--bg-
       surface)`, `color: var(--text)`, `cursor: text`, plus focus ring
       (`box-shadow` + border warna primary) — dicocokkan ke pola yang
       sudah ada di `_forms.scss` (`.form-control:disabled` pakai token
       yang sama persis: `--bg-surface-secondary` / `--text-muted`),
       bukan bikin pola baru.
- Diverifikasi: `npm run lint` (0 error) dan `npm run build` (sukses,
  chunk `profile.js`/`user-detail.js` ke-generate, HTML hasil build
  dicek manual — DOCTYPE & shell injection sidebar masih utuh meski ada
  komentar baru di `<head>`), struktur wrapper kedua halaman sudah
  dicocokkan baris-per-baris dengan `client-detail.html`, sweep
  grep untuk sisa teks Bahasa Indonesia di keempat file (2 HTML + 2 JS)
  sudah bersih. Klik-lewat browser sempat dicoba lagi tapi masih
  terblokir oleh auth guard di environment ini (browser sandbox ini
  tidak punya sesi login Ray yang sudah diverifikasi manual di
  environment dia) — jadi verifikasi Save/Discard/toast dan tampilan
  visual lock-icon/dimmed-field di atas masih lewat code review teliti,
  bukan klik langsung. Perlu dicek manual oleh Ray: field bisa diedit &
  tersimpan, toast sukses/error muncul, Discard beneran reset ke nilai
  lama, dan bedanya field editable vs read-only kelihatan jelas secara
  visual.

### Fixed

- **Issue #115: `profile.js` mengirim field `company`/`bio` yang tidak
  ada di schema.** `updateProfile()` sekarang hanya mengirim
  `full_name` dan `phone` — `company`/`bio` sengaja dikecualikan dari
  load dan payload save (pola sama seperti `avatar_url`), tidak
  memerlukan migration baru. Perubahan `production/profile.html`
  (restrukturisasi layout, di luar scope task ini) dibatalkan, tidak
  ikut di-commit.

## [2.24.0] - 2026-08-25

### Changed
- **Issue #117: Samakan layout `profile.html` dengan `user_detail.html`.**
  Halaman "Profil Saya" (punya user sendiri) sekarang pakai pola visual yang
  sama dengan halaman User Detail admin (Issue #113): kartu foto/badge di
  kiri + panel "Personal information" di kanan.
  - `production/profile.html`: kartu "Your Profile" (avatar Bootstrap +
    nama/role/email/lokasi) dan form "Personal Information" (First
    name/Last name/Email/Phone/Role/Company/Bio) diganti jadi 1 section
    grid 2 kolom (`pf-row`/`pf-card`/dst — nama class beda dari
    `user_detail.html` yang pakai `ud-*` karena kedua halaman ini masih
    punya `<style>` masing-masing, tidak share satu stylesheet), meniru
    persis struktur & style `ud-row-main`/`ud-card`/`ud-form-value`
    (termasuk state read-only dengan dimmed background + glyph 🔒, dan
    state editable dengan input standar) di `user_detail.html`. CSS-nya
    disalin (bukan di-import) supaya `user_detail.html` sendiri tidak
    ikut disentuh, sesuai permintaan Ray.
  - Field kiri: avatar (fallback ui-avatars.com, warna teal `#1abb9c`
    disamakan dengan `user-detail.js` — sebelumnya biru `#0d6efd`), nama,
    role, email, badge role + badge status akun (`account_status`, kolom
    yang sudah ada tapi belum pernah ditampilkan di `profile.html`). Tidak
    ada link "Manage Account" (halaman ini punya user sendiri, tidak ada
    tempat lain untuk redirect) dan tidak ada tombol upload avatar (masih
    sama seperti sebelumnya — `profiles` belum punya kolom `avatar_url`).
    Field lokasi ("Indonesia", teks statis tidak terhubung ke data apapun)
    dihapus karena `user_detail.html` juga tidak menampilkannya.
  - Field kanan ("Personal information"): cuma 4 field — **Full name**
    (editable, gabungan First/Last name lama jadi 1 field sesuai
    kolom asli `full_name`), **Email** (read-only), **Phone** (editable),
    **Role** (read-only, gaya lock-icon sama seperti field read-only
    lain). `Company`/`Bio` TIDAK ditambah balik — sudah sengaja dihapus
    di Issue #115 karena kolomnya tidak ada di schema, di luar scope
    perbaikan ini. `Role` sengaja tetap read-only untuk semua orang
    (termasuk admin yang lihat profil sendiri) — trigger
    `prevent_profile_privilege_escalation` cuma izinin ubah role dari
    alur User Management/User Detail yang memang didesain untuk itu,
    bukan dari halaman self-service ini.
  - Card "Notifications", "Account stats", "Connected accounts", "Recent
    activity" di bawahnya TIDAK diubah — di luar scope task ini (task
    cuma minta samakan bagian hero + Personal Information).
  - `src/v4/profile.js`: `saveProfile()` tetap kirim `{ full_name, phone }`
    saja ke `updateProfile()` (payload dari Issue #115, tidak diubah),
    sekarang baca dari 1 field `editFullName` (bukan gabung
    `editFirstName`+`editLastName`). Ditambah validasi "Full name is
    required" dan disable-tombol-saat-menyimpan, meniru pola
    `saveUserDetail()` di `user-detail.js`. Tombol "Cancel" diganti jadi
    "Discard" (nama tombol sama seperti `user_detail.html`) dan sekarang
    reset ke nilai terakhir yang berhasil di-load di memory (state lokal,
    fungsi baru `discardProfile()`), bukan reload penuh dari DB seperti
    sebelumnya — sama seperti `discardUserDetail()`. Pesan sukses/gagal
    save diganti dari `alert()` ke `showToast()` (`src/v4/toast.js`) biar
    konsisten dengan `user-detail.js` — bagian lain file ini (Notifications,
    tombol Connect) masih pakai `alert()`, sengaja tidak disentuh karena
    di luar scope.
- Diverifikasi: `npm run lint` (0 error, warning yang ada cuma `no-alert`
  di kode yang memang sengaja tidak disentuh + `no-console` di file lain
  yang tidak diubah) dan `npm run build` (sukses, chunk `profile.js`
  ter-generate). Klik-lewat browser di dev server terblokir oleh auth
  guard (redirect ke `login.html`, sama persis seperti yang dilaporkan di
  entry Issue #113 sebelumnya — environment ini tidak punya sesi login
  yang tervalidasi) — jadi Save/Discard belum bisa diklik-tes langsung
  di environment ini. Sebagai gantinya, layout & CSS diverifikasi visual
  lewat mock HTML statis terpisah (bukan bagian dari app, tidak
  di-commit) yang me-render markup+CSS `profile.html` dan
  `user_detail.html` berdampingan dengan data contoh — dikonfirmasi kartu
  profil kiri dan form kanan (termasuk state read-only vs editable)
  benar-benar cocok secara visual. **Perlu dicek manual oleh Ray**: login
  ke `profile.html`, cek field Full name/Phone bisa diedit & tersimpan,
  toast sukses/error muncul, Discard reset ke nilai lama, dan badge role
  + status akun menampilkan data yang benar.

## [2.22.0] - 2026-08-24

### Added
- **Issue #109: Role Management & Account Status**. Kolom baru
  `profiles.account_status` (ACTIVE/SUSPENDED/DISABLED) + audit
  (`status_changed_at`, `status_changed_by`, `status_reason`).
  - `auth_role()`/`auth_client_id()` sekarang return NULL kalau
    `account_status != 'ACTIVE'` — proteksi terpusat, otomatis berlaku
    ke SEMUA RLS policy di seluruh app (documents, payments,
    case_quotations, case_stages, dll) tanpa perlu ubah policy satu-satu.
  - Trigger `prevent_profile_privilege_escalation` diperluas: sekarang
    juga melindungi kolom `account_status` (sebelumnya cuma `role`/
    `client_id`), hanya admin/supervisor yang boleh ubah.
  - **Proteksi last-active-admin** (ditambahkan Claude setelah review
    rencana awal Gemini): trigger menolak perubahan yang akan membuat
    TIDAK ADA admin aktif tersisa ("Tidak bisa menonaktifkan admin
    terakhir yang aktif"). Ini mencegah lockout total dari sistem.
- Diverifikasi lewat 2 transaction test: (1) suspend admin
  satu-satunya yang aktif -> ditolak dengan error yang jelas, (2)
  suspend user non-admin -> berhasil normal.
- Kerja kolaboratif Ray + Gemini (skema dasar, UI awal) + Claude
  (review keamanan, proteksi last-admin, eksekusi & verifikasi
  migration).

## [2.21.1] - 2026-08-24

### Fixed
- **Data `profiles.full_name` salah** — backfill Issue #99 (dieksekusi
  manual via Supabase SQL Editor, tanpa migration file — menyimpang
  dari konvensi psql Session Pooler) mengisi `full_name` dari prefix
  email, bukan dari kolom `name` yang sudah benar. Contoh: Ray
  `full_name` sempat "soulmediaglobal.ind" (harusnya "Ray").
  - Fix: `UPDATE profiles SET full_name = name`. Kolom `full_name`/
    `email` dipertahankan (dipakai rencana Issue #100), cuma datanya
    yang dikoreksi.
  - Migration ini juga mencatat resmi ke git skema `full_name`/`email`
    yang sebelumnya live di production tanpa migration file
    (`add column if not exists`, idempotent).
- Diverifikasi ke database: 5 profile, semua `full_name` sekarang sama
  persis dengan `name`.

## [2.21.0] - 2026-08-24

### Changed
- **Project Setting — restrukturisasi Jenis Dokumen vs Jenis Layanan**
  (Issue #91, revisi setelah Issue #94/schema landed). Reorganisasi UI 3
  tab di `project_setting.html`. Scope awalnya read-only/lebih sederhana
  (lihat commit sebelumnya di branch ini), direvisi Ray setelah
  `document_categories` + `document_templates.category_id` +
  `service_type_codes.code` UNIQUE (Issue #94) landed di `main` — scope
  Tab 1 melebar dari read-only jadi full CRUD, dan Tab 2 dapat 3
  perubahan tambahan.
  - **Tab "Jenis Dokumen"** — sekarang full CRUD, bukan read-only lagi:
    - **Kategori**: list `document_categories` (urut `order_index`),
      "+ Tambah Kategori", edit nama (rename), reorder pakai tombol
      ↑/↓ per kategori (swap `order_index` antara 2 baris bertetangga —
      2 `update` biasa, bukan RPC/transaction, karena `order_index` tidak
      unique jadi collision sementara saat swap aman, dan tab selalu
      reload dari DB lagi sesudahnya baik sukses maupun gagal sebagian).
    - **Dokumen per kategori**: list `document_templates` dikelompokkan
      per kategori, "+ Tambah Dokumen" (nama + pilih kategori) dan "Edit"
      per dokumen (ubah nama dan/atau pindah ke kategori lain lewat
      dropdown `category_id`).
    - Nama kategori dobel (constraint UNIQUE) ditangkap dan ditampilkan
      sebagai toast error yang ramah ("Nama kategori sudah dipakai."),
      bukan error mentah dari Postgres.
    - Form pakai pola modal yang sama dengan tab Rekening Bank
      (`showModal()` + form `reportValidity()` + submit button
      disable/reset), bukan bikin pola baru.
  - **Tab "Jenis Layanan"** — 3 perubahan dari versi commit sebelumnya:
    1. **"+ Tambah Layanan"** sekarang bikin jenis layanan yang benar-benar
       baru (input bebas nama + kode), bukan cuma pilih dari
       `cases.service_type` yang sudah ada seperti sebelumnya — arah lama
       itu terbalik menurut Ray, karena project baru sering butuh jenis
       layanan yang belum pernah dipakai di project manapun.
       Constraint UNIQUE baru di `service_type_codes.code` (dan PK
       `service_type` yang sudah ada dari awal) ditangkap sebagai toast
       ramah ("Kode ... sudah dipakai jenis layanan lain." / "Jenis
       layanan ... sudah ada."), bukan raw DB error.
    2. **Checklist dokumen pakai search per kategori**, bukan checkbox
       polos digelontor semua sekaligus seperti sebelumnya — tiap
       kategori dari `document_categories` jadi section sendiri dengan
       search box (`.search-box`, komponen yang sudah ada di
       `_layout.scss`, dipakai ulang bukan bikin baru) yang filter live
       (`input` event, cocokkan substring nama dokumen, case-insensitive)
       tanpa query DB tambahan — filter di data yang sudah di-load.
       Feedback UX langsung dari Ray: checkbox-dump per kategori kurang
       jelas.
    3. **Edit kode existing juga sadar constraint UNIQUE** — kalau ganti
       kode ke nilai yang sudah dipakai jenis layanan lain, toast ramah
       muncul dan input dikembalikan ke nilai lama (sama seperti
       constraint gagal saat "+ Tambah Layanan", helper error message
       yang sama dipakai di dua tempat).
    - Checklist per dokumen & toggle `default_service_types` tetap logic
      yang sama dari commit sebelumnya (arah tulis dari sisi service,
      kolom DB tidak berubah, `client-quotations.js` tetap baca kolom
      yang sama tanpa disentuh).
  - **Tab "Rekening Bank"**: tidak disentuh sama sekali (diverifikasi
    diff literal terhadap versi sebelumnya — identik).
  - Admin-only (`canEdit = profile.role === 'admin'`) tetap sama
    pattern-nya di semua tab — supervisor/internal lihat versi read-only
    (checklist/checkbox disabled, tanpa tombol tambah/edit). RLS
    `document_categories_admin_all` / `document_templates_admin_all`
    tidak diubah/dibuat ulang.
  - `npm run lint` dan `npm run build` PASS.
- **Bug ditemukan (di luar scope, di-flag terpisah, tidak diperbaiki di
  sini)**: `client-quotations.js` (modal RAB/Quotation di Client Detail)
  masih query kolom `document_templates.category` yang sudah dihapus
  migrasi Issue #94 (`20260824120000_...sql`) — bikin modal RAB gagal
  load ("Gagal memuat data RAB & Penawaran.") untuk semua case begitu
  perubahan schema itu sampai ke `main`. Bukan regresi dari sesi ini
  (schema sudah begini sebelum sesi ini mulai, file ini di luar scope
  Issue #91 per AGENTS.md ownership rules), tapi perlu issue/branch
  terpisah untuk fix query-nya (join ke `document_categories` seperti
  yang dipakai tab Jenis Dokumen/Jenis Layanan di atas).

### Belum diverifikasi manual
- Login OTP butuh akses email yang tidak tersedia buat AI agent (blocker
  sama seperti part-part sebelumnya, lihat v2.16.0/v2.18.0/v2.19.0/
  v2.20.0) — belum dicoba end-to-end di browser sungguhan. RLS juga
  memblokir verifikasi via anon key langsung (tidak ada policy select
  untuk role anon/publik di `document_categories` /
  `document_templates` / `service_type_codes`), jadi query manual pun
  tidak bisa tanpa login. Sudah direview lewat kode saja (lint+build
  PASS, diff literal buat pastikan tab Rekening Bank benar-benar tidak
  berubah, trace manual semua alur CRUD + error handling constraint
  UNIQUE). Yang masih perlu dicek manual: tambah/edit/reorder kategori
  di tab Jenis Dokumen, tambah/edit/pindah-kategori dokumen, "+ Tambah
  Layanan" dengan kode/nama dobel (pastikan toast ramah bukan raw DB
  error), search box per kategori di checklist tab Jenis Layanan
  benar-benar filter tanpa reload, dan edit kode existing ke nilai yang
  sudah dipakai jenis layanan lain.

## [2.20.1] - 2026-08-24

### Fixed
- **HOTFIX: query kolom `document_templates.category` yang sudah
  dihapus**. Migration Issue #94 (v2.20.0) menghapus
  `document_templates.category` (diganti `category_id` FK ke
  `document_categories`), tapi 2 file masih query kolom lama —
  menyebabkan error di production setiap kali dibuka:
  - `client-quotations.js` — section "RAB & Penawaran" gagal load total
    (`templatesResult.error`), ditemukan CCA saat membaca kode sebagai
    referensi task lain.
  - `project-setting.js` — tab "Kelola Dokumen" gagal load
    ("Gagal memuat daftar template dokumen"), ditemukan Ray saat testing
    manual.
  - Fix: kedua file diubah untuk embed `category:document_categories(name)`
    via `category_id`, sorting kategori dipindah ke JS (bukan lagi
    `.order('category', ...)` di query, karena tidak bisa order by
    kolom di embedded relation dengan aman).
- Diverifikasi VISUAL langsung di browser: error hilang di kedua
  tempat setelah fix diterapkan.

## [2.20.0] - 2026-08-24

### Added
- **Project Setting — Kategori Dokumen CRUD + Kode Layanan Unique
  (schema)**. Lanjutan restrukturisasi Issue #91.
  - Tabel baru `document_categories` (name UNIQUE, order_index) — 4
    kategori existing (Identitas, Legalitas, Teknis, Keuangan) di-seed.
    RLS pola sama seperti tabel konfigurasi lain (admin manage,
    supervisor/internal select-only).
  - `document_templates.category` (text bebas) diganti
    `category_id` (FK ke document_categories). Data lama dibackfill
    otomatis berdasarkan nama kategori yang cocok.
  - `service_type_codes.code` ditambah UNIQUE constraint — sebelumnya
    tidak ada, padahal seharusnya kode tidak boleh kembar.
- Diverifikasi ke database: 15 dokumen ter-backfill sempurna (3
  Identitas, 9 Legalitas, 2 Teknis, 1 Keuangan — cocok dengan angka
  Part IV), 0 baris fallback, constraint unique berhasil tanpa error
  (konfirmasi 21 kode existing memang sudah unik).
- **Catatan sequencing**: branch ini dibuat dari main (v2.19.0),
  PARALEL dengan Issue #91 (restrukturisasi tab, belum merged) — bukan
  numpuk di atasnya. UI kategori dokumen yang baru (task berikutnya)
  butuh gabungan #91 + #94, urutan merge perlu #91 dulu baru #94, atau
  task UI berikutnya dibuat dari branch yang sudah include keduanya.

## [2.19.0] - 2026-08-24

### Added
- **Project Setting — Kode Layanan** (Issue #85). Tab ke-3 (terakhir) di
  `project_setting.html`, melengkapi "Kelola Dokumen" dan "Kelola Rekening
  Bank" dari v2.18.0. Pola tab-underline (`data-project-setting-tab`/
  `data-project-setting-panel`, `activateProjectSettingTab`/
  `wireProjectSettingTabs`) di-reuse persis, cuma nambah tab ke-3 —
  mekanisme tab tidak diubah.
  - List semua baris `service_type_codes` (`service_type`, `code`), tabel
    yang sudah ada + terisi 21 baris dari migrasi
    `20260824070000_project_part5-2_rab_formal_schema.sql`. Kolom ini
    dibaca `generate_quotation_number()` (trigger, tidak disentuh) buat
    bikin nomor quotation format `SMA/YYYY-MM/CODE/seq`.
  - **Edit kode inline per baris** — input text per baris, simpan otomatis
    lewat event `change` (ke-trigger browser saat blur setelah value
    berubah), bukan tombol Simpan terpisah kayak tab "Kelola Dokumen" atau
    modal kayak tab "Kelola Rekening Bank" — sesuai spec issue ("save on
    change/blur"). Validasi UI-level saja: wajib diisi, maks 3 karakter
    (`maxlength` di input + cek JS) — cocok sama batas `varchar(3)` yang
    sudah ada di kolom, tapi TIDAK menambah constraint DB baru (di luar
    scope issue). Gagal simpan → toast error + input dikembalikan ke nilai
    lama.
  - **"+ Tambah Kode"** — modal pilih `service_type` dari dropdown (opsi =
    nilai `cases.service_type` yang distinct dan belum punya baris di
    `service_type_codes`, di-query live, bukan hardcode) + input kode 3
    karakter, lalu `insert`. Kalau semua jenis layanan sudah punya kode,
    tombol munculkan toast info alih-alih modal kosong.
  - Admin-only (`canEdit = profile.role === 'admin'`) sama seperti 2 tab
    lain di halaman ini — supervisor/internal lihat versi read-only tanpa
    input/tombol, RLS `service_type_codes_admin_all`/`_supervisor_select`/
    `_internal_select` dari migrasi v2.x sebelumnya tidak diubah/dibuat
    ulang. `generate_quotation_number()` trigger tidak disentuh sama
    sekali, sesuai batasan scope issue.
  - `npm run lint` dan `npm run build` PASS.

### Belum diverifikasi manual
- Login OTP butuh akses email yang tidak tersedia buat AI agent (blocker
  sama seperti part-part sebelumnya, lihat v2.16.0/v2.18.0) — belum
  dicoba end-to-end di browser sungguhan. Sudah direview lewat kode saja
  (lint+build PASS, cross-check terhadap pola 2 tab lain yang sudah ada di
  file yang sama). Yang masih perlu dicek manual: switching antar 3 tab
  bareng-bareng, edit kode tersimpan ke `service_type_codes` + toast
  sukses/error muncul benar (termasuk kasus kode kosong/reset ke nilai
  lama saat gagal), "+ Tambah Kode" nampilin cuma jenis layanan yang belum
  punya kode dan berhasil insert, serta tampilan read-only buat
  supervisor/internal.

## [2.18.0] - 2026-08-24

### Added
- **Project Setting — Multi Rekening Bank (UI)** (Issue #78). Melengkapi
  schema-only dari v2.17.0 dengan UI kelola + pemilihan rekening.
  - **`project_setting.html` direstruktur jadi 2 tab** — "Kelola Dokumen"
    (section `document_templates` yang sudah ada dari v2.16.0) dan
    "Kelola Rekening Bank" (section baru). Pola tab di-reuse PERSIS dari
    `client-detail.html`/`client-detail.js` (`.tabs-underline`/`.tab`,
    `activateTab`/`wireTabs` — di sini `activateProjectSettingTab`/
    `wireProjectSettingTabs` dengan atribut senama tapi dinamai ulang
    `data-project-setting-tab`/`data-project-setting-panel` biar tidak
    tabrakan sama punya client-detail), bukan mekanisme tab baru. Konten
    tiap tab fungsinya identik dengan sebelumnya (cuma dipindah dari 2
    card bertumpuk jadi 2 tab panel), `initProjectSetting()` yang sama
    tetap menginisialisasi keduanya lewat `Promise.all` begitu section
    tab-nya dipasang.
  - **Tab "Kelola Rekening Bank"**: list semua `bank_accounts` (bank_name,
    account_holder_name, account_number, bank_code, badge Aktif/Nonaktif),
    tambah rekening baru, edit semua field lewat `showModal()` (pola form
    sama seperti "+ Tambah Termin" di `client-payments.js`). Admin-only
    (`canEdit = profile.role === 'admin'`) — supervisor/internal lihat
    versi read-only tanpa tombol kontrol, RLS `bank_accounts_admin_all`/
    `_supervisor_select`/`_internal_select` dari migrasi v2.17.0 tidak
    diubah/dibuat ulang.
  - **Toggle `is_active`, bukan hapus baris** — rekening lama yang sudah
    dipakai RAB (via `case_quotations.bank_account_id`) tetap harus bisa
    dibuka; hard-delete akan membuat FK itu orphan/error. Tombol
    "Nonaktifkan"/"Aktifkan" cuma `UPDATE ... SET is_active = ...`.
  - **Dropdown rekening bank di draft editor RAB** (`client-quotations.js`,
    `buildDraftEditor`) — section baru "Rekening Bank" sejajar dengan
    Detail Pekerjaan/Termin, pola sama seperti `buildDescriptionEditor`
    (select + tombol "Simpan Rekening" sendiri, ikut juga di aggregate
    "Simpan" lewat `saveAll()`). Opsi dropdown = `bank_accounts` yang
    `is_active = true`, DITAMBAH rekening yang sedang terpilih di draft
    itu kalau sudah dinonaktifkan sejak dipilih (supaya pilihan yang
    sudah tersimpan tidak hilang dari tampilan, tanpa menambah pilihan
    baru selain yang aktif). Tidak ada logic auto-pilih rekening default
    — sesuai scope Issue, admin pilih manual tiap kali.
  - **Preview dokumen formal** (`openQuotationPreview` /
    `buildPreviewContent`) — section "Rekening Pembayaran" sekarang baca
    `bank_accounts` lewat `case_quotations.bank_account_id` milik
    quotation yang di-preview (`fetchBankAccount`), bukan lagi
    `company_settings` (satu rekening hardcoded). `company_settings`
    TIDAK disentuh (tetap ada, tidak dipakai — legacy sesuai instruksi).
    Kalau `bank_account_id` null (quotation lama dari sebelum fitur ini,
    atau draft yang belum pilih rekening), section ini menampilkan baris
    placeholder ("Rekening bank belum dipilih untuk penawaran ini.")
    alih-alih error atau menampilkan "undefined".
  - `npm run lint` dan `npm run build` PASS.

### Belum diverifikasi manual
- Login OTP butuh akses email yang tidak tersedia buat AI agent (blocker
  yang sama seperti part-part sebelumnya, lihat v2.16.0) — belum dicoba
  end-to-end di browser sungguhan. Sudah direview lewat kode saja
  (lint+build PASS). Yang masih perlu dicek manual: tambah/edit rekening
  di Project Setting beneran ke-update di `bank_accounts` dan toast
  sukses/error muncul benar, toggle Aktif/Nonaktif, dropdown rekening di
  draft editor RAB muncul & tersimpan ke `case_quotations.bank_account_id`,
  dan Preview menampilkan rekening yang benar (termasuk kasus
  `bank_account_id` null menampilkan placeholder, bukan error).

## [2.15.0] - 2026-08-24

### Added
- **PROJECT — Part VI: Alur Terima/Tolak/Nego**. Menutup lingkaran
  7-part PROJECT feature. Schema only — UI tombol Terima/Tolak/Nego
  dibangun di sisi client (mitra.soulmitra.id, tanggung jawab Dimas).
  - RLS write untuk role `client` di `case_quotations` — client bisa
    UPDATE quotation miliknya sendiri, cuma dari status SENT, cuma
    boleh transisi ke ACCEPTED/REJECTED/NEGOTIATING.
  - Trigger `prevent_client_quotation_tampering` — proteksi kolom,
    client cuma boleh ubah status/responded_at/client_response_notes,
    tidak bisa menyelipkan perubahan total_amount/quotation_number/dst
    lewat request yang sama. Pola sama seperti
    `profiles_prevent_privilege_escalation` dan
    `payments_prevent_invoice_receipt_tampering` yang sudah ada.
  - Trigger `handle_quotation_response` — otomasi saat status berubah:
    ACCEPTED → `cases.intake_status` jadi ACCEPTED, generate `payments`
    dari `case_quotation_items` (1:1 per termin), generate 6
    `case_stages` (idempotent — skip kalau case sudah punya stages)
    + set `current_stage_id`. REJECTED → `cases.intake_status` jadi
    REJECTED.
- Diverifikasi lewat transaction test manual (BEGIN...ROLLBACK):
  ACCEPTED menghasilkan 4 payments (sesuai 4 termin asli), 6 case_stages
  urut dengan owner benar, current_stage_id ter-set. REJECTED
  menghasilkan intake_status yang benar. Idempotency case_stages
  dikonfirmasi via 2 pengecekan independen (case yang sama, exists-check
  sebelum & sesudah).

## [2.17.1] - 2026-08-24

### Fixed
- **SUPERSEDED tidak pernah ditulis saat revisi RAB**. `createDraftQuotation()`
  di `client-quotations.js` tidak menandai versi `case_quotations` lama
  jadi `SUPERSEDED` saat versi baru dibuat lewat "+ Buat RAB Baru" —
  status `SUPERSEDED` sudah didefinisikan (label/CSS) tapi tidak ada
  kode yang menulisnya. Dampak: setelah client Nego dan admin buat RAB
  baru, versi lama tetap berstatus `NEGOTIATING` selamanya.
  - Fix: `UPDATE case_quotations SET status='SUPERSEDED' WHERE
    case_id=... AND status != 'DRAFT'` sebelum insert versi baru.
  - Tidak diblokir kalau update tidak kena baris (mis. role `internal`
    yang RLS-nya cuma boleh update quotation berstatus `DRAFT`, lihat
    Part V RLS tightening) — `createDraftQuotation` tetap lanjut untuk
    role itu, limitasinya dicatat di sini, bukan hard blocker.
- Diverifikasi VISUAL langsung di browser oleh Ray: versi lama berubah
  jadi badge "Digantikan" setelah "+ Buat RAB Baru" diklik.

## [2.17.0] - 2026-08-24

### Added
- **Project Setting — Multi Rekening Bank (schema)**. Perluasan dari
  `company_settings` (v2.13.0, single rekening key-value) jadi tabel
  `bank_accounts` yang bisa menampung banyak rekening, dipilih per-RAB.
  - Tabel baru `bank_accounts`: bank_name, account_holder_name,
    account_number, bank_code, is_active. RLS pola sama seperti
    `document_templates`/`service_type_codes` (admin manage,
    supervisor/internal select-only, tidak ada akses client).
  - Data lama dari `company_settings` (BCA) dimigrasi jadi baris
    pertama (kode bank 014).
  - Kolom baru `case_quotations.bank_account_id` — rekening yang
    dipilih per-RAB.
  - `company_settings` TIDAK dihapus, tapi tidak dipakai lagi untuk
    info rekening ke depannya.
  - UI (Project Setting + dropdown di RAB builder) belum dibangun —
    task terpisah setelah ini.
- Diverifikasi ke database: 1 baris bank_accounts (data BCA lama)
  berhasil dimigrasi lengkap.

## [2.16.0] - 2026-08-24

### Added
- **Project Setting — Kelola Dokumen Wajib per Jenis Layanan** (Issue #72).
  Halaman admin baru pertama di bawah roadmap "Project Setting" (backlog
  di Issue punya beberapa sub-fitur lanjutan — `service_type_codes` dan
  `company_settings`, keduanya masih ditunda, task terpisah). Task ini
  cuma `document_templates.default_service_types`.
  - Nav item baru **"Project Setting"** (`production/project_setting.html`,
    group "Sistem"), `roles: ['admin']` di NAV — pola identik dengan
    "User Management" yang sudah ada (`src/lib/auth-guard.js` yang
    nyembunyiin nav item berdasarkan role, bukan mekanisme baru).
  - Halaman me-list semua `document_templates` (15 baris seed dari Part
    IV), dikelompokkan per `category` (Identitas/Legalitas/Teknis/
    Keuangan) — pola grouping identik dengan "Dokumen Wajib" di
    `client-quotations.js` (iterate hasil query yang sudah di-`order`,
    munculkan heading tiap kali `category` berubah).
  - Field `default_service_types` per template pakai komponen
    **multi-select chip yang sudah ada** (`v4/form-controls.js`,
    `data-multi-select`) — bukan input teks comma-separated. Dipilih
    karena komponennya sudah jadi & dipakai di tempat lain
    (`production/form.html`), dan opsinya (distinct `cases.service_type`,
    di-query live lewat `select('service_type')` + dedupe di JS, **bukan
    hardcode** — beda dari daftar `SERVICE_TYPES` hardcoded di
    `case-form.js`, sengaja query karena data historis di `cases` punya
    lebih banyak jenis layanan daripada dropdown form saat ini) ada
    puluhan — search-to-add lebih pas daripada ngetik manual/typo-prone.
    `initFormControls()` dipanggil manual setelah render (bukan
    otomatis dari `main-v4.js` — itu cuma jalan sekali saat page load
    berdasarkan DOM statis, sementara baris template di sini muncul
    async setelah fetch Supabase selesai).
  - Simpan per-baris (tombol "Simpan" sendiri per template, bukan satu
    tombol simpan-semua) — update langsung ke
    `document_templates.default_service_types` lewat RLS
    `document_templates_admin_all`.
  - Role gating UX di dalam halaman: non-admin (supervisor/internal,
    yang punya RLS SELECT-only di tabel ini) lihat versi read-only
    (chip statis, tanpa kontrol edit/simpan) alih-alih kontrol yang
    nanti gagal saat disimpan — pola `canManageX` yang sama dengan
    `client-quotations.js`/`client-documents.js`/`case-form.js`. Ini
    murni UX convenience menambah dari yang diminta Issue (yang cuma
    minta nav item admin-only); RLS tetap satu-satunya security
    boundary yang sebenarnya.
  - Out of scope (sesuai Issue): tidak ada tambah/hapus baris
    `document_templates` (fitur "kelola master dokumen" terpisah, masih
    ditunda).

### Belum diverifikasi manual
- Login OTP butuh akses email yang tidak tersedia buat AI agent (blocker
  yang sama seperti part-part PROJECT sebelumnya) — halaman ini belum
  dicoba end-to-end di browser sungguhan sebagai admin, cuma direview
  lewat kode + `npm run lint`/`npm run build` (keduanya PASS). Yang
  masih perlu dicek manual: render grouping per kategori, isi/perilaku
  multi-select (search, tambah/hapus chip), simpan per-baris beneran
  ke-update di `document_templates` dan toast sukses/error muncul benar,
  serta visibilitas nav item cuma untuk admin.

## [2.14.0] - 2026-08-24

### Added
- **PROJECT — Part V.2: UI Preview Dokumen Formal** (Issue #66). Semua
  perubahan di `client-quotations.js` (bukan file baru). Rujukan yang
  disebut Issue #66 (`SPEC_PROJECT_Part_V2_RAB_Formal.md`) ternyata
  tidak pernah ada sebagai file di repo — cuma disebut di deskripsi
  Issue #60/#62/#66, kemungkinan lampiran GitHub yang tidak pernah
  dicommit. Sesi ini jalan dari struktur 12-poin & scope yang sudah
  ditulis lengkap di deskripsi Issue #66 sendiri, bukan dari file itu.
  - **Tombol aksi tunggal "Buat Penawaran" dipecah jadi 3**: **Simpan**
    (baru — aggregate save, menjalankan `save()` dari ketiga editor
    section — Deskripsi, Detail Pekerjaan, Termin Pembayaran — secara
    berurutan dan berhenti di section pertama yang gagal; masing-masing
    section tetap punya tombol simpan sendiri seperti sebelumnya, ini
    cuma nambah satu tombol eksplisit buat simpan semuanya sekaligus),
    **Preview** (baru, lihat di bawah), **Kirim Penawaran** (rename
    dari "Buat Penawaran" — logic DRAFT→SENT-nya tidak berubah, termasuk
    gating admin/supervisor-only dan validasi ≥1 Detail Pekerjaan).
  - **Preview dokumen formal**: dibuka di tab browser baru
    (`window.open`), bukan `showModal()` — stylesheet print yang sudah
    ada (`_pages.scss`) nge-hide `.modal-backdrop` di `@media print`,
    yang bakal bikin halaman blank kalau preview dirender di dalam
    modal terus dipanggil `window.print()`. Tab baru dapat CSS sendiri
    (inline `<style>`, latar putih, font serif, styling surat resmi —
    sengaja lepas dari tema dashboard gelap), tombol "Print / Simpan
    sebagai PDF" (`window.print()`) dan "Tutup". Seluruh konten dibangun
    lewat `document.createElement`/`textContent` di dokumen tab baru
    tersebut (bukan `innerHTML`), jadi data client/PIC tetap aman dari
    HTML injection.
  - **Preview tersedia di setiap versi di "Riwayat Versi"**, bukan cuma
    DRAFT yang lagi diedit — Preview murni aksi baca (tidak mengubah
    status), jadi versi lama yang sudah SENT/ACCEPTED/REJECTED/NEGOTIATING
    tetap bisa direview/diprint persis seperti saat dikirim. Tombolnya
    ada di samping toggle expand tiap baris versi (bukan di dalamnya —
    `<button>` tidak boleh bersarang di `<button>`), reuse fungsi render
    preview yang sama, cuma datanya beda per versi.
  - **Tanggal dokumen ikut status versi**: DRAFT (belum pernah dikirim)
    pakai tanggal hari ini (surat penawaran lazimnya bertanggal saat
    dicetak/dikirim, bukan saat draft-nya dibuat). Versi yang sudah
    pernah dikirim pakai `sent_at` (fallback `created_at`) — supaya
    preview versi lama menunjukkan tanggal asli saat dikirim, bukan
    tanggal hari ini saat direview belakangan.
  - **Struktur dokumen** (11 dari 12 poin — poin "jumlah lampiran"
    sengaja dikosongkan, belum didefinisikan, sesuai catatan eksplisit
    Issue #66): tanggal, nomor RAB, perihal (`cases.service_type`),
    "Kepada Yth." (PIC + jabatan + `clients.type`/`name`/`address`),
    paragraf deskripsi, tabel Rincian Pekerjaan
    (`case_quotation_line_items`, dengan baris total), daftar Dokumen
    yang Diperlukan (baris tabel `documents` untuk case ini — pola
    sama seperti Part V), tabel Termin Pembayaran
    (`case_quotation_items`, dengan baris total), Rekening Pembayaran
    (`company_settings`), Kontak, paragraf penutup (menyebut penawaran
    bisa direspon terima/tolak/nego lewat portal client — tombolnya
    sendiri belum dibangun, itu Part VI, di luar scope sesi ini).
  - **Kontak (poin 11) sengaja query baru**, bukan reuse
    `case_quotations.creator` yang sudah ada di layar — join yang sudah
    ada itu "siapa yang bikin RAB", bukan "siapa yang bikin project"
    (`cases.created_by`), dua orang yang bisa beda. Query baru
    `cases.select('created_by, creator:profiles!created_by(id, name,
    phone)')`. Nomor telepon nullable — kalau kosong, baris telepon
    di-skip (bukan tampil "null" atau error); kalau creator/phone gagal
    di-fetch sama sekali (mis. RLS), seluruh section Kontak di-skip,
    bukan crash.

### Belum diverifikasi manual
- Login OTP masih blocker yang sama seperti Part V/V.2 sebelumnya —
  seluruh flow di atas cuma direview lewat kode + `npm run
  lint`/`npm run build` (keduanya PASS), belum diklik langsung dengan
  data project asli di browser. Perlu diverifikasi manual: tampilan
  preview dengan data lengkap (line items, termin, dokumen terisi),
  popup blocker behavior, dan hasil `window.print()` di browser asli.

---

## [2.13.0] - 2026-08-24

### Added
- **PROJECT — Part V.2: Preview Dokumen Formal (schema)** (Issue #64).
  Lampiran PRD (SPEC_PROJECT_Part_V2_RAB_Formal.md, §Bagian Baru).
  Schema only, belum ada UI preview — UI-nya menyusul di v2.14.0.
  - Tabel baru `company_settings` (key-value) — rekening SMA (BCA,
    a.n. Soul Mitra Abadi). RLS: admin manage-all, supervisor & internal
    select-only (pola sama seperti `document_templates`/
    `service_type_codes`), tidak ada akses client. Sudah diisi data
    asli (bukan placeholder).
  - Kolom baru `profiles.phone` — nomor HP staff, untuk kontak
    "pembuat project" di preview dokumen nanti. Nullable, tidak wajib
    diisi retroaktif.

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

## [Unreleased] - Issue #99

### Added
- Integrated dynamic Supabase data fetching for `production/user_management.html`.
- Added automated device tracking (`last_login_device` & `last_sign_in_at`) on user session initialization via `trackCurrentSession()`.
- Added dynamic project count calculations aggregated from `case_assignees` and `cases.client_id`.
- Added custom inline color coding for user role badges (`admin`, `supervisor`, `internal`, `client`) and randomized initial avatars.

### Database
- Added migration columns `full_name` and `email` to `public.profiles` table with email backfill synchronization from `auth.users`.
