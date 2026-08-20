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

### Belum selesai
- Issue #6 — Tab Case & Progress (card case, ubah status, reassign PIC)
- Issue #7 — Form Tambah Case Baru
- Issue #8 — Tab Dokumen (checklist per case)
- Issue #9 — Tab Pembayaran (termin, tandai lunas)
- Issue #10 — Tab Aktivitas (log manual + auto-log)

---

## [1.5.0] - 2026-08-20

### Added
- Halaman **Form Tambah Client Baru** (`production/client-form.html`,
  `src/v4/client-form.js`) — form satu halaman, 4 section sesuai PRD §5.1
  (Identitas Badan Usaha, Kontak PIC, Kontak Direktur, Lainnya). Validasi
  `name`+`type` wajib, peringatan lunak untuk nama client yang mirip,
  redirect ke halaman Detail Client setelah submit sukses.
- Issue #5 closed, PR [#14](../../pull/14) merged.

### Changed
- `AGENTS.md`: klarifikasi kebijakan owner-bypass — cross-review tetap jadi
  norma standar, tapi repo owner boleh bypass approval saat reviewer
  genuinely tidak tersedia (bukan default kebiasaan).

---

## [1.4.0] - 2026-08-20

### Added
- Halaman **Detail Client** (`production/client-detail.html`) dengan shell
  5-tab (Info, Case & Progress, Dokumen, Pembayaran, Aktivitas).
- Tab **Info**: read-view data client + mode Edit/Simpan/Batal, terintegrasi
  dengan Supabase.
- 4 container kosong disiapkan sebagai kontrak untuk Issue #6, #8, #9, #10
  (`client-panel-cases`, `client-panel-documents`, `client-panel-payments`,
  `client-panel-activities`) — dibangun lebih awal oleh Dimas untuk
  membuka jalan bagi kerjaannya sendiri.
- Issue #4 closed, PR [#13](../../pull/13) merged.

---

## [1.3.0] - 2026-08-19

### Added
- Migration: kolom identitas & kontak lengkap di tabel `clients` — `npwp`,
  `nib`, `business_field`, `address`, `pic_name`, `pic_title`, `pic_phone`,
  `pic_email`, `director_name`, `director_phone`, `director_id_number`,
  `referral_source`, `general_notes`.
- Issue #3 closed, PR [#12](../../pull/12) merged.

### Removed
- Kolom lama `contact_name`, `contact_phone`, `contact_email` di tabel
  `clients` (data dipindahkan ke kolom `pic_*` sebelum di-drop).

---

## [1.2.0] - 2026-08-19

### Added
- Halaman **Client List** (`production/client.html`, `src/v4/client-list.js`)
  — tabel semua client dengan search (nama/PIC) dan filter (tipe, status
  case aktif). "Jumlah Case Aktif" dan "Total RAB Aktif" dihitung real-time
  dari agregasi tabel `cases`.
- Link nav "Client" di sidebar diarahkan ke halaman ini.
- Issue #2 closed, PR [#11](../../pull/11) merged.

---

## [1.1.1] - 2026-08-19

### Added
- `CLAUDE.md` — stub kecil yang menunjuk ke `AGENTS.md`, supaya Claude Code
  (yang secara default membaca `CLAUDE.md`, bukan `AGENTS.md`) tetap
  otomatis mengikuti aturan project yang sama dengan tool AI lain.

---

## [1.1.0] - 2026-08-19

### Added
- `AGENTS.md` — rulebook kolaborasi tim: konteks project, aturan git
  (branch-per-issue, wajib PR, cross-review), peta kepemilikan file per
  issue, konvensi kode & query Supabase.
- `PRD_Client_Management_SMA-app.pdf` — spesifikasi lengkap fitur Client
  Management: persona, model data, 9 breakdown fitur & cara kerjanya.
- 9 GitHub Issues (#2-#10) dibuat dengan deskripsi, acceptance criteria,
  assignee, dan label lengkap.
- GitHub Project board ("Team Planning" / "Soul Media Abadi App") dengan
  semua 9 issue ter-link.

### Infrastructure
- Dimas (`dancowwkk`) diundang sebagai collaborator repo dengan akses Write.
- Branch protection rule pada `main`: wajib Pull Request + minimal 1
  approval sebelum merge (aktif setelah repo diset ke Public, karena
  GitHub Free tidak meng-enforce branch protection di repo Private).

---

## [1.0.0] - 2026-08-19

Rilis fondasi pertama — dari kosong ke aplikasi yang bisa login dan
menampilkan dashboard dengan data real dari Supabase.

### Added
- Base project: Gentelella v4 (vanilla JS ES2022 + Vite), di-clone dan
  di-rebrand dari "Gentelella" menjadi "Soul Mitra Abadi" (sidebar, halaman
  login, favicon).
- Skema database Supabase awal: tabel `clients`, `profiles`, `cases`,
  `activities`, `documents`, `payments` — lengkap dengan RLS policy untuk
  3 role (`admin`, `internal`, `client`).
- Autentikasi magic-link/OTP via Supabase Auth, invite-only
  (`shouldCreateUser: false`), dengan `emailRedirectTo` dinamis mengikuti
  `window.location.origin`.
- Dashboard **Overview**: 4 stat card (Total Client, Case Aktif, Piutang
  Belum Lunas, Total Nilai RAB Aktif), breakdown Case per Status, feed
  Aktivitas Terbaru, tabel Case Terbaru — semua query real ke Supabase.
- Seed data dummy untuk testing (5 client, 8 case, dokumen, pembayaran,
  aktivitas).

### Infrastructure
- Repo GitHub `soulmediaglobal/sma-app` dibuat dan kode pertama kali di-push.
- Akun baru dibuat khusus untuk project ini: GitHub (`soulmediaglobal`),
  Supabase, Resend (custom SMTP untuk mengatasi rate limit bawaan Supabase
  Auth saat testing).

[Unreleased]: https://github.com/soulmediaglobal/sma-app/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/soulmediaglobal/sma-app/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/soulmediaglobal/sma-app/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/soulmediaglobal/sma-app/releases/tag/v1.0.0
