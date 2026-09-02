# Doc_Changelog

Changelog **khusus governance** untuk `DEVELOPMENT_RULES.md` ("The Document").
Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), konsisten dengan `App_Changelog.md` (riwayat development/fitur produk) — **tapi dua file ini tidak boleh dicampur isinya.**

Dikelola oleh Mike, Guardian of The Document. Bersifat **append-only** — revisi terhadap entry lama dibuat sebagai entry baru, bukan mengedit entry lama.

**Skema versi untuk dokumen ini** (`DEVELOPMENT_RULES.md`), lihat juga C8P1–C8P2:
- **MAJOR** (x.0.0) — redesign governance yang breaking, perubahan filosofi source-of-truth, redefinisi workflow fundamental.
- **MINOR** (0.x.0) — poin/Chapter baru, kapabilitas governance baru.
- **PATCH** (0.0.x) — klarifikasi, koreksi fakta kecil, refinement non-breaking.

**Kategori entry**: `Added` (poin/chapter baru), `Changed` (revisi rule existing), `Corrected` (koreksi fakta, bukan rule baru), `Removed`.

Tiap bullet mengutip poin terdampak dengan kode `C{chapter}P{point}` (lihat C0P2) supaya presisi. Kalau perubahan butuh persetujuan eksplisit sebelum berlaku, ditutup dengan baris **"Disetujui oleh [nama]"**.

---

## [2.2.5] - 2026-08-31

### Added
- **C10P6 — Recipes**: sub-section baru "Kredensial publik project (Supabase & deploy)" — Project URL, Publishable key, Anon Key, dan link production dicatat langsung. Ditegaskan eksplisit: `service_role key`/DB password **tidak boleh** pernah masuk dokumen ini atau file manapun di repo, cuma anon/publishable key (client-side, dilindungi RLS) yang aman disimpan.
- **C10P1**: baris index Recipes diperbarui lagi.

**Disetujui oleh Ray.**

---

## [2.2.4] - 2026-08-31

### Added
- **C10P6 — Recipes**: sub-section baru "Cari info Supabase (session pooler / region)" — session pooler connection string dan region project dicatat langsung, supaya AI di sesi kerja baru tidak perlu tanya-tanya ulang tiap kali butuh export DB via terminal. Password sengaja tetap placeholder `[YOUR-PASSWORD]`, tidak pernah ditulis asli.
- **C10P1**: baris index Recipes diperbarui untuk mencerminkan penambahan ini.

**Disetujui oleh Ray.**

---

## [2.2.3] - 2026-08-31

### Changed
- **Header dokumen**: field `Status: SYNCED/DRAFT` dihapus total dari header. Field ini sudah 3 kali basi/kontradiksi dengan kondisi repo aktual (v2.2.0, v2.2.1, v2.2.2 — sempat terlewat di-update setelah push, ditemukan lewat laporan sendiri maupun dari sesi kerja lain seperti Task 4/11 Issue #161). Riwayat sync sekarang cukup dilacak lewat entry terbaru di file ini (`Doc_Changelog.md`), yang append-only dan otomatis akurat karena pembuatan entry baru memang bagian dari proses commit — menghilangkan sumber masalahnya, bukan cuma memperbaiki kejadiannya satu-satu.
- Header sekarang hanya berisi: Document Version, Project, Guardian, Bahasa, Terakhir diupdate.

**Disetujui oleh Ray.**

---

## [2.2.2] - 2026-08-31

### Corrected
- **Footer dokumen (setelah C10P9)**: paragraf penutup basi dihapus — sebelumnya masih tertulis "Dokumen ini masih berstatus DRAFT. Belum disinkronkan ke repository GitHub. Menunggu review dan persetujuan Ray sebelum EXECUTION", kontradiksi langsung dengan header (`Status: SYNCED`) dan C6P1. Kemungkinan sisa draft sebelum commit pertama yang tidak terhapus saat finalisasi. Ditemukan dan dilaporkan oleh AI Dimas (sesi kerja terpisah, sisi client portal), diverifikasi oleh Mike sebelum dikoreksi.

**Status:** SYNCED — commit `d398eea` di `origin/main` (2026-08-31). Terlambat diupdate — dilaporkan oleh sesi kerja Task 4/11 (Issue #161) yang menemukan header masih tertulis DRAFT padahal dokumen sudah live dan digunakan sebagai referensi aktif.

---

## [2.2.1] - 2026-08-31

### Corrected
- **C6P1**: catatan status implementasi diperbaiki — sebelumnya menyatakan stub `CLAUDE.md`/`.cursor/rules/project.mdc`/`.github/copilot-instructions.md` belum diupdate secara fisik di repo. Faktanya ketiganya sudah diupdate sejak commit `68859ca` (Tahap C selesai). Kalimat diperbarui untuk mencerminkan kondisi aktual.
- **C7P2**: baris `App_Changelog.md` di tabel peta dokumen diperbaiki — sebelumnya menyatakan status "draft lokal, belum diterapkan ke repo". Faktanya sudah live di repo sejak commit `78263ac` (rename dari `changelog.md`, struktur dirapikan).

**Status:** SYNCED — commit `38e6b27` di `origin/main` (2026-08-31).

---

## [2.2.0] - 2026-08-31

### Added
- **Chapter 10 — Technical Reference & Component Library**: bab baru, konsolidasi konten `AGENTS.md` (dipangkas dari branding Gentelella generik, npm publish, referensi CDN) dan konten berguna dari `CONTRIBUTING.md` (spacing scale, tabel pemetaan SCSS partial, disiplin komentar).
- **C6P7 — Tiered Reading Rule**: model baca dua tingkat untuk mengelola token cost seiring bertambahnya ukuran dokumen karena Chapter 10. Tier 1 (Chapter 0-9 + C10P1) wajib full-read tiap sesi tanpa pengecualian. Tier 2 (C10P2-P9) dibaca sesuai kebutuhan task, dituntun oleh index C10P1 — bukan penilaian bebas AI. Kriteria "dibutuhkan" didefinisikan eksplisit lewat pencocokan ke deskripsi index, menghindari ambiguitas kata "sesuai kebutuhan".
- **C5P7 — Test File Security**: file test wajib tidak berisi URL hardcoded atau data sensitif (credential, token, API key, connection string produksi); gunakan environment variable atau fixture/mock data. Dipindahkan dari `tests/README.md` (dihapus di Tahap D) agar rule tidak hilang.

### Changed
- **C6P1 — Reference Model**: diperbarui untuk mencerminkan status implementasi — `AGENTS.md` sudah dipangkas dan digabung jadi Chapter 10; stub `CLAUDE.md`, `.cursor/rules/project.mdc`, `.github/copilot-instructions.md` disiapkan mengarah ke Chapter 10, tapi isi fisiknya di repo belum diupdate (Tahap C) — deletion `AGENTS.md` (Tahap D) harus menunggu Tahap C selesai untuk menghindari dangling reference.
- **C6P2 — Kewajiban AI Sebelum Mulai Kerja**: poin baca dokumen disesuaikan dengan model tiered reading (Chapter 0-9 + C10P1, lihat C6P6/C6P7).
- **C6P6 — AI Onboarding SOP & Escalation Criteria**: langkah 1 (baca dokumen) disesuaikan referensinya ke C6P2 dan model tiered reading.
- **C7P2**: tabel peta dokumen diperbarui untuk mencerminkan Chapter 10 dan penghapusan `AGENTS.md`/`CONTRIBUTING.md`/`docs/*.md`/`examples/` dari struktur dokumentasi project.

**Status:** SYNCED — commit `68859ca` di `origin/main` (2026-08-31).

---

## [2.1.0] - 2026-08-29

### Corrected
- **C1P2, C5P1**: jumlah role diperbaiki jadi empat (`admin`, `supervisor`, `internal`, `client`), sebelumnya tertulis tiga. Ditambahkan info dua domain terpisah (`team.soulmitra.id` untuk admin, `mitra.soulmitra.id` untuk client portal — yang kedua sengaja belum live).
- **C5P1**: mekanisme login diperbaiki — staff (`admin`/`supervisor`/`internal`) pakai OTP-only, client pakai Google OAuth atau Email+Password. Sebelumnya salah tertulis magic-link untuk semua. Ditambahkan catatan gap keamanan terkait (lihat `KNOWN_GAPS.md` #2).
- **C2P2**: model kerja Ray dan Dimas diperbaiki — paralel per-domain (Ray di sisi admin, Dimas di sisi client portal, masing-masing dengan AI sendiri), sebelumnya digambarkan sebagai share-file per-issue.

### Changed
- **C3P8**: ditambah larangan eksplisit — AI hanya boleh melakukan aksi yang diminta eksplisit per-langkah (commit ≠ otomatis lanjut push/PR).
- **C5P5**: ditambah larangan eksplisit — migration yang tercatat/merged di git tidak boleh diasumsikan sudah dijalankan ke database production tanpa verifikasi langsung.
- **C7P2**: tabel peta dokumen ditambah baris referensi `KNOWN_GAPS.md`.

### Added
- **C3P9** — Definition of Done: checklist wajib sebelum sebuah task dianggap selesai/merge-ready.
- **C6P4** — Verification Protocol: tabel jenis klaim vs cara verifikasi wajib.
- **C6P5** — Repository Sync Check: ritual pembuka sesi kerja, kondisi repo aktual menang atas instruksi/briefing lama.
- **C6P6** — AI Onboarding SOP & Escalation Criteria: urutan kerja wajib untuk AI + kriteria eksplisit penghentian AI yang berulang gagal ikuti rule.
- File baru `KNOWN_GAPS.md` — tracker gap arsitektur/keputusan tertunda, diisi 5 entry awal.

**Status:** DRAFT — belum disinkronkan ke repository. Menunggu approval Ray.

---

## [2.0.0] - 2026-08-29

### Added
- `DEVELOPMENT_RULES.md` dibuat sebagai The Document canonical untuk SMA-app, terpisah dari `AGENTS.md`.
- Sistem penomoran `C{chapter}P{point}` (C0P2) untuk referensi presisi di seluruh dokumen.
- Reference model untuk file instruksi AI: `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, `.github/copilot-instructions.md` diarahkan ke dokumen ini untuk governance (C6P1).
- Struktur otoritas eksplisit (C2P2): Ray = final decision maker, Dimas = butuh approval Ray.
- **C3P8** — AI Merge Boundary: AI boleh siapkan merge-ready state, tidak pernah merge sendiri ke `main`.
- **Chapter 7** — Documentation Structure: lokasi canonical dokumen + naming convention.
- **C4P1–C4P3** — Ownership task/issue sengaja tidak dihardcode di dokumen, mendukung rotasi tugas Ray↔Dimas.

**Status:** DRAFT — belum disinkronkan ke repository. Menunggu approval Ray.
