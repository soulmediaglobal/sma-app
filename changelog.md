# Changelog

Semua perubahan penting pada project ini didokumentasikan di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
dan project ini mengikuti [Semantic Versioning](https://semver.org/).

**Skema versi buat project ini:**
- **MAJOR** (x.0.0) — milestone besar yang koheren, misalnya satu modul penuh
  dari roadmap 10-fitur selesai total (contoh: seluruh Client Management,
  issue #2-#10, selesai = v2.0.0).
- **MINOR** (0.x.0) — satu fitur/halaman baru yang bisa dipakai user (biasanya
  1 GitHub Issue = 1 minor bump).
- **PATCH** (0.0.x) — perubahan non-fitur: dokumentasi, konfigurasi, klarifikasi
  aturan kolaborasi, perbaikan kecil yang tidak menambah kapabilitas baru.

---

## [Unreleased]

Menuju **v2.0.0** — seluruh modul Client Management (Issue #2-#10) selesai.

### Belum selesai (jatah Dimas)
- Issue #8 — Tab Dokumen (checklist per project)
- Issue #9 — Tab Pembayaran (termin, tandai lunas per project)
- Issue #10 — Tab Aktivitas (log manual + auto-log dari #6/#8/#9, wajib dikerjain terakhir)

---

## [1.7.2] - 2026-08-20

### Changed
- Relabel UI tersisa dari Case ke Project: dashboard Overview ("Case Aktif"
  -> "Project Aktif", "Case per Status" -> "Project per Status", "Case
  Terbaru" -> "Project Terbaru") dan Client List ("Jumlah Case Aktif" ->
  "Jumlah Project Aktif"). Menyelesaikan rename terminologi UI yang
  sebagian sudah dikerjakan lewat PR #17 (client-detail.html).

---

## [1.7.1] - 2026-08-20

### Fixed
- `src/v4/client-form.js` (defensive): UUID client baru sekarang di-generate
  di browser (`crypto.randomUUID()`) sebelum insert, dikirim eksplisit,
  dan dipakai langsung untuk redirect ke halaman Detail Client — tidak
  lagi bergantung pada baca-balik (`.select('id').single()`) pasca-insert
  yang berisiko gagal kalau RLS SELECT/INSERT policy suatu saat berbeda
  scope. Issue #15 closed, PR [#18](../../pull/18).
- `eslint.config.js`: tambah `crypto` ke browser-globals whitelist.

---

## [1.7.0] - 2026-08-20

### Added
- Tab **Project** (Detail Client): dropdown ubah status project (klik badge
  -> Baru/Proses/Selesai/Batal), dropdown reassign PIC (role-gated,
  admin-only). Keduanya otomatis mencatat baris baru ke tabel `activities`.
- Styling card project (border, background, spacing) yang sebelumnya belum
  ada.
- Issue #6 closed, PR [#17](../../pull/17). Dikerjakan Ray (aslinya jatah
  Dimas, dilanjutkan dari progress parsial listing project yang sudah ada).

---

## [1.6.0] - 2026-08-20

### Added
- Halaman **Form Tambah Case/Project Baru** (`src/v4/case-form.js`) — modal
  di tab Project untuk menambahkan layanan baru ke client yang sedang dibuka.
- Issue #7 closed, PR [#16](../../pull/16). Dikerjakan Ray (aslinya jatah
  Dimas).

### Fixed
- Bug: insert case berhasil ke database tapi UI menampilkan toast error
  palsu, akibat `.select('id').single()` pasca-insert gagal terbaca
  (kemungkinan scope RLS SELECT berbeda dari INSERT). Fix: berhenti
  bergantung pada baca-balik itu.

---

## [1.5.0] - 2026-08-20

### Added
- production/client-form.html + src/v4/client-form.js - form 4 section, validasi, redirect ke Detail Client

### Changed
- AGENTS.md: klarifikasi kebijakan owner-bypass buat kondisi darurat

---

## [1.4.0] - 2026-08-20

### Added
- production/client-detail.html - shell 5-tab (Info, Case & Progress, Dokumen, Pembayaran, Aktivitas)
- Tab Info: read-view + mode Edit/Simpan/Batal
- 4 container kosong disiapkan buat Issue #6/#8/#9/#10

---

## [1.3.0] - 2026-08-19

### Added
- Kolom identitas & kontak lengkap di tabel `clients`: npwp, nib, business_field, address, pic_*, director_*, referral_source, general_notes

### Removed
- Kolom lama contact_name/contact_phone/contact_email (data dipindahkan dulu)

---

## [1.2.0] - 2026-08-19

### Added
- production/client.html + src/v4/client-list.js - tabel, search, filter, agregasi case aktif & RAB

---

## [1.1.1] - 2026-08-19

### Added
- CLAUDE.md yang menunjuk ke AGENTS.md, biar Claude Code otomatis ikut aturan yang sama

---

## [1.1.0] - 2026-08-19

### Added
- AGENTS.md - rulebook kolaborasi, aturan git, peta kepemilikan file
- PRD_Client_Management_SMA-app.pdf
- 9 GitHub Issues (#2-#10) dengan deskripsi & acceptance criteria lengkap
- GitHub Project board

### Infrastructure
- Dimas (dancowwkk) diundang collaborator, akses Write
- Branch protection main: wajib PR + 1 approval (aktif setelah repo diset Public)

---

## [1.0.0] - 2026-08-19

Rilis fondasi pertama — dari kosong ke aplikasi yang bisa login dan
menampilkan dashboard dengan data real dari Supabase.

### Added
- Base project: Gentelella v4 (vanilla JS ES2022 + Vite), di-clone dan
  di-rebrand dari "Gentelella" menjadi "Soul Mitra Abadi"
- Skema database Supabase awal: clients, profiles, cases, activities,
  documents, payments — lengkap dengan RLS policy untuk 3 role
- Autentikasi magic-link/OTP via Supabase Auth, invite-only
- Dashboard Overview dengan query real ke Supabase
- Seed data dummy untuk testing

### Infrastructure
- Repo GitHub soulmediaglobal/sma-app dibuat dan kode pertama kali di-push
- Akun baru: GitHub (soulmediaglobal), Supabase, Resend (custom SMTP)

---

## Catatan tambahan (non-versioned, housekeeping)

- **2026-08-20**: Assignee GitHub Issue #3, #6, #7 dikoreksi jadi `soulmediaglobal` (Ray beneran yang ngerjain, sebelumnya masih nyantol assignee draft awal ke Dimas).
- **2026-08-20**: Login diperbaiki — template email Supabase diubah dari Magic Link (`{{ .ConfirmationURL }}`) jadi kode OTP (`{{ .Token }}`), dan panjang kode disamakan dari 8 digit (default Supabase) ke 6 digit (sesuai kolom input app). Dicatat sebagai gotcha di AGENTS.md.
- **2026-08-20**: Judul & deskripsi Issue #6, #8, #9 diupdate memakai istilah "Project" (bukan "Case & Progress") untuk konsistensi dengan keputusan rename UI.

[Unreleased]: https://github.com/soulmediaglobal/sma-app/compare/v1.7.2...HEAD
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
