# PRD: Project Intake & RAB Workflow — SMA-app

**Versi:** 3.0 (Draft — masih bisa direvisi begitu ada prototype visual)
**Terakhir diupdate:** 23 Agustus 2026, 04:42
**Konteks:** Turunan dari `SMA_APP_MASTER_ARCHITECTURE.js` (generic
workflow-engine, DITOLAK — lihat catatan proses di bawah), lalu
`PRD_Workflow_Layer_SMA-app.md` v1.0 (case_stages, versi ramping),
sekarang diperluas jadi alur intake project lengkap: bikin project →
generate RAB → kirim penawaran → client Terima/Tolak/Nego → Workflow
mulai.
**Pembagian kerja:** Ray = Admin side, Dimas = Client side, paralel.

---

## 1. Alur Besar

Halaman Project itu **1 halaman, 2 section independen** — bukan 1
wizard raksasa, bukan juga 2 alur yang benar-benar terpisah.

```
[Buat Project — Section "Info Project"]
       |
       +- Project Creator     (cases.created_by — otomatis, read-only)
       +- Project Type        (cases.service_type — pilih jenis layanan)
       +- Tambah Team         (case_assignees — bisa 0 atau lebih, opsional)
       +- Deskripsi           (cases.notes)
       |
       v
[Simpan] -> project langsung ada, intake_status = DRAFT
            Section RAB & Penawaran kelihatan tapi statusnya
            "Belum Dibuat" — TIDAK menghalangi save di atas
       |
       | (kapan saja siap, tidak harus langsung, tidak ada batas waktu)
       v
[Section "RAB & Penawaran" — independen, buka kapan saja]
       |
       +- Badge status: Belum Dibuat / Draft / Menunggu Persetujuan /
       |  Diterima / Ditolak / Nego
       +- Riwayat semua versi penawaran tetap terlihat (case_quotations
       |  sudah versioned dari Part I — v1 ditolak, v2 revisi, dst,
       |  semua tetap bisa dibuka, bukan cuma versi terakhir)
       +- Tentukan dokumen yang harus di-upload client (multi-select
       |  dari document_templates)
       +- Rincian biaya + termin + syarat tiap termin
       |
       v
[Klik "Buat Penawaran"] -> intake_status = QUOTED,
                            case_quotations.status = SENT
                            (hanya admin/supervisor yang bisa memicu
                            aksi ini — lihat §4)
       |
       v
[Client lihat penawaran di dashboard-nya]
       |
       +- TERIMA --------> intake_status = ACCEPTED, RAB di-lock,
       |                    payments ter-generate dari termin,
       |                    case_stages mulai (Workflow aktif)
       |
       +- TOLAK ---------> intake_status = REJECTED, Workflow tidak
       |                    diproses
       |
       +- NEGO ----------> versi lama jadi SUPERSEDED (tapi TETAP
                            terlihat di riwayat, tidak disembunyikan),
                            balik ke admin, RAB versi baru dibuat, kirim
                            ulang penawaran (looping ke "RAB & Penawaran")
```

**Prinsip kunci:** Project **tidak pernah nge-block** menunggu RAB.
Project bisa dibuat, disimpan, tim di-assign, dikerjakan orangnya
(secara administratif/koordinasi) — sambil RAB-nya masih digodok
dengan hati-hati di section terpisah, kapan pun siap. Alasan Ray: RAB
butuh waktu, harus dihitung hati-hati, tidak boleh jadi penghalang
project untuk langsung dicatat dan mulai dikerjakan secara administratif.

---

## 2. Skema Data — Kontrak Bersama

### 2.1 Field "Info Project" — semua sudah ada, TIDAK ada tabel/kolom baru

| Field UI | Sumber data | Status |
|---|---|---|
| Project Creator | `cases.created_by` | Sudah ada (Part III) |
| Project Type | `cases.service_type` | Sudah ada (dari awal) |
| Tambah Team | `case_assignees` | Sudah ada (Part III) |
| Deskripsi | `cases.notes` | Sudah ada (dari awal, perlu dicek apakah sudah dipakai di form manapun) |
| Badge status RAB + riwayat versi | `cases.intake_status` + `case_quotations` (sudah versioned) | Sudah ada (Part I) |

### 2.2 `case_quotations` — RAB / penawaran header (sudah dibangun, Part I)

Versioned, status: `DRAFT / SENT / ACCEPTED / REJECTED / NEGOTIATING /
SUPERSEDED`. Kolom lengkap sudah ada di
`supabase/migrations/20260822200000_project_part1_schema_foundation.sql`.

### 2.3 `case_quotation_items` — rincian termin (sudah dibangun, Part I)

### 2.4 `document_templates` — master jenis dokumen (sudah dibangun & di-seed, Part I & IV)

15 dokumen umum sudah tersedia. Bukan bagian dari PRD ini untuk
membuat UI kelola master — itu fitur terpisah, ditunda.

---

## 3. Dampak ke Pembagian Part

| Part | Status | Catatan |
|---|---|---|
| I — Schema Foundation | Selesai (v2.5.0) | document_templates, case_quotations, case_quotation_items, cases.intake_status |
| II — Rekonsiliasi Data Existing | Selesai (v2.6.0) | 42/43 case → ACCEPTED |
| III — Assign Tim UI | Selesai (v2.7.0), diverifikasi visual | Sekalian: PIC diganti "Dibuat oleh" (cases.created_by) |
| IV — Seed Document Templates | Selesai (v2.8.0) | 15 dokumen, tervalidasi |
| V — RAB/Penawaran Builder | Belum mulai | Tetap berat (kalkulasi termin, multi-select dokumen). Dipicu dari halaman project yang sudah ada. Riwayat versi harus tampil, bukan cuma versi aktif |
| VI — Alur Terima/Tolak/Nego | Belum mulai | Approval RAB sisi internal butuh role admin/supervisor (lihat §4) |
| VII — Wizard Tambah Project | Belum mulai | Jauh lebih ringan — 4 field, tanpa RAB, tanpa dokumen, murni info dasar + save |

---

## 4. Role — Siapa Bisa Apa (final)

**Role tertinggi: Ray (`admin`) dan Tomy (`supervisor`)** — keduanya
"owner-level", bisa approve/kirim RAB tanpa approval tambahan dari
siapapun.

**Prinsip pembatasan RAB (perlu direview presisi saat Part V/VI
dikerjakan):**
- `internal` boleh bikin/edit **draft** `case_quotations` (status DRAFT)
- Hanya `admin`/`supervisor` yang boleh mengubah status jadi `SENT`
  (memicu "Buat Penawaran" ke client)
- RLS `case_quotations` yang sudah dibangun di Part I saat ini masih
  memberi `internal` akses INSERT/UPDATE tanpa pembatasan status — ini
  KEMUNGKINAN perlu diperketat (mirip pola `payments_internal_insert`
  yang membatasi ke status Pending saja) saat Part V/VI dikerjakan,
  belum final.

**Catatan:** Tomy belum punya akun di sistem (masih 1 user: Ray).
Assign role `supervisor` ke Tomy baru bisa dieksekusi begitu ada
mekanisme invite staff (roadmap #10, belum dibangun) atau manual via
SQL kalau perlu lebih cepat.

---

## 5. Yang Perlu Disinkronkan ke Dimas

- Client butuh halaman "Penawaran Menunggu Persetujuan" — tombol
  Terima/Tolak/Nego
- RLS `case_quotations`/`case_quotation_items` untuk client saat ini
  SELECT-only (Part I) — akses tulis (Terima/Tolak/Nego) SENGAJA
  ditunda ke Part VI, logic keamanan transisi statusnya belum dibangun
- Kemungkinan tumpang tindih dengan Issue #25 (Client Self-Service
  Portal) — perlu dibahas siapa bangun bagian mana

---

## 6. Rekonsiliasi Data Existing — Selesai (Part II)

42 dari 43 case sudah punya `case_stages` sebelum PRD ini ada,
direkonsiliasi retroaktif ke `intake_status = ACCEPTED` + 1
`case_quotations` dummy (status ACCEPTED) per case. 1 case ("Tau
Bbanget" — SLF, hasil testing manual, tidak punya `case_stages`) tetap
`DRAFT`, tidak direkonsiliasi — sesuai kriteria, bukan pengecualian
khusus.

---

## 7. Open Questions

**Terjawab:**
1. ~~Riwayat versi RAB lama masih terlihat saat Nego?~~ **Ya**, semua
   versi tetap terlihat, tidak disembunyikan (lihat §1).
2. ~~Auto-reminder/expiry quotation SENT lama?~~ **Ditunda**, tidak
   masuk scope sekarang.
3. ~~Siapa approve RAB dari sisi internal?~~ **Ray & Tomy** (lihat §4).

**Masih terbuka:**
4. Form "+ Tambah Project" yang sekarang (`case-form.js`) — apakah
   field `notes` sudah dipakai di situ atau belum?
5. Desain visual badge status RAB — belum dibahas, menyusul begitu ada
   visual untuk direview.
6. Detail teknis pembatasan RLS `case_quotations` untuk `internal`
   (lihat §4) — perlu dirumuskan presisi saat Part V/VI dikerjakan.

---

## Backlog Terpisah (di luar PRD ini, dicatat supaya tidak hilang)

- Halaman **"Project Setting"** di sidebar — atur relasi
  `service_type` ↔ `document_templates` (dokumen wajib per jenis
  layanan). Data source-nya `document_templates.default_service_types`
  yang sudah di-seed di Part IV, tinggal dibuatkan UI-nya.

## Housekeeping

- Issue #35 (task lama "Actions, Transitions & current_owner" dari
  pendekatan generic-engine yang sudah dibatalkan) masih berstatus
  OPEN di GitHub — perlu ditutup manual dengan catatan "not planned".
  Branch-nya sudah dihapus (kosong, tidak ada commit).
- Dimas belum dikabari soal seluruh perubahan arah sesi 22 Agustus
  2026 (revert generic-engine, PRD Project Intake baru, dst) — masih
  pending sejak sesi sebelumnya.

---

## Catatan Proses (bukan bagian PRD, log diskusi)

- 22 Agustus 2026, pagi: draft v1 ditulis berdasarkan penjelasan lisan
  Ray soal alur intake → RAB → approval → workflow. Disetujui sementara
  ("oke dulu, nanti sambil kita lihat hasilnya"), bukan spec final.
- 22 Agustus 2026, malam: Part I-IV diimplementasi & merge (v2.5.0-
  v2.8.0). Part III diverifikasi visual, ditemukan 2 bug + 1 perubahan
  desain (PIC → Project Creator) di tengah jalan, sudah diperbaiki.
- 22 Agustus 2026, malam: revisi v2 — Project & RAB dipisah jadi 2
  section independen dalam 1 halaman (bukan 1 wizard sekaligus).
- 23 Agustus 2026, 04:42: revisi v3 — role final ditetapkan (Ray=admin,
  Tomy=supervisor/"owner"), 3 open question dari v2 dijawab.
- Tab Workflow yang sudah disambungkan ke data real (Issue #40, di
  luar PRD ini) TETAP DIPERTAHANKAN apa adanya — tidak dirombak ulang
  untuk menyesuaikan PRD ini kecuali ada keputusan eksplisit.
