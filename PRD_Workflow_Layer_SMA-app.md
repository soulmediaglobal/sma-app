# PRD: Workflow Layer, Document Versioning & Billing Enhancement — SMA-app

**Versi:** 1.0 (Draft)
**Tanggal:** 21 Agustus 2026
**Konteks:** Turunan dari `SMA_APP_MASTER_ARCHITECTURE.js` (hasil kerja AI
lain), disederhanakan ("jalan tengah") setelah didiskusikan dengan Ray.
**Pembagian kerja:** Ray = Admin side, Dimas = Client side, paralel.

---

## 1. Keputusan Arsitektur Kunci

Dokumen arsitektur asli mengusulkan **generic workflow engine** (template
+ instance + transition rules sebagai layer terpisah, 5+ tabel). Setelah
didiskusikan, dipilih **versi ramping**: tiap case punya daftar tahapnya
sendiri di 1 tabel (`case_stages`) yang admin bisa edit bebas per-project
— tanpa perlu sistem "konfigurasi template" terpisah.

**Alasan:** kebutuhan fleksibilitas Ray nyata (tiap client, walau minta
layanan yang sama, prosesnya bisa beda karena kesiapan data & biaya) —
tapi itu cukup dijawab dengan "daftar tahap yang bisa diedit per-case",
bukan mesin aturan generic yang jauh lebih berat dibangun & di-maintain.

Hasil visual di UI **sama persis** dengan yang diusulkan dokumen asli
(timeline stage, box "Action Required", dst) — bedanya cuma di
implementasi belakang layar.

---

## 2. Skema Data — Kontrak Bersama (WAJIB disepakati sebelum coding paralel)

### 2.1 Tabel baru: `case_stages`
Satu case (project) sekarang punya banyak baris di sini — daftar
tahapnya sendiri, urutan & isinya bisa beda per-case.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| case_id | uuid | FK ke `cases` |
| name | text | Nama tahap, misal "Doc Collection", "Verification", "Processing", "Payment", "Final Delivery" |
| order_index | int | Urutan tampil |
| status | text | PENDING / IN_PROGRESS / WAITING / BLOCKED / COMPLETED / SKIPPED / CANCELLED |
| owner | text | ADMIN / CLIENT / SYSTEM — siapa yang pegang bola di tahap ini |
| blocking_reason | text, nullable | Kenapa nge-block (kalau status BLOCKED) |
| due_at | timestamptz, nullable | SLA/deadline tahap ini |
| started_at | timestamptz, nullable | |
| completed_at | timestamptz, nullable | |
| created_at, updated_at | timestamptz | |

### 2.2 Kolom baru di `cases`
| Kolom | Tipe | Keterangan |
|---|---|---|
| current_stage_id | uuid, nullable, FK ke case_stages | Pointer ke tahap yang lagi aktif |

**"Siapa pegang bola sekarang" (`current_owner`)** dihitung dari
`case_stages` yang ditunjuk `current_stage_id` — TIDAK disimpan sebagai
kolom terpisah, biar gak ada 2 sumber kebenaran yang bisa gak sinkron.

### 2.3 Default stage per jenis layanan
Bukan tabel database — cukup **konstanta di kode** (`src/v4/`), lookup
`service_type -> default stage list`. Waktu case dibuat, sistem otomatis
insert baris-baris default ke `case_stages` sesuai jenis layanannya.
Setelah itu, admin bebas edit (tambah/hapus/reorder/ubah owner) khusus
case itu — tidak memengaruhi case lain.

### 2.4 Tabel baru: `document_versions`
Tabel `documents` yang sudah ada jadi "slot kebutuhan dokumen" (misal
"KTP Direktur"). Riwayat upload-nya sekarang tersimpan di sini, bukan
menimpa `file_url` langsung seperti sekarang.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| document_id | uuid | FK ke `documents` |
| version_number | int | 1, 2, 3, dst |
| file_url | text | |
| status | text | Belum / Upload / Terverifikasi / Ditolak (tetap 4 status yang sudah ada, tidak diperluas) |
| rejection_reason | text, nullable | **Wajib diisi kalau status Ditolak** |
| uploaded_by | uuid, FK profiles | |
| created_at | timestamptz | |

Status yang ditampilkan di UI = status dari versi **terbaru**. Versi
lama (termasuk yang ditolak) tetap tersimpan, bisa dilihat riwayatnya.

### 2.5 Perluasan `payments` (bukan tabel invoice/receipt terpisah)

**Keputusan (konsisten dengan prinsip "jalan tengah" di atas):**
daripada bikin 3 tabel terpisah (`invoices`, `invoice_items`,
`receipts`) seperti di dokumen asli, cukup **tambah kolom** ke tabel
`payments` yang sudah ada — karena pola bisnis SMA sekarang (1 termin =
1 jumlah tetap, tidak ada pembayaran sebagian dalam 1 termin) tidak
butuh pemisahan invoice-vs-payment sebagai entity beda.

| Kolom baru di `payments` | Tipe | Keterangan |
|---|---|---|
| invoice_number | text, nullable | Format `INV-{tahun}-{urutan}`, diisi sistem saat invoice di-generate |
| invoice_issued_at | timestamptz, nullable | |
| receipt_number | text, nullable | Format `KWT-{tahun}-{urutan}`, diisi sistem saat pembayaran diverifikasi |
| receipt_issued_at | timestamptz, nullable | |

**Catatan:** ini asumsi/rekomendasi Ray, bukan keputusan final — kalau
nanti ternyata SMA butuh 1 invoice mencakup beberapa termin sekaligus,
desain ini perlu direvisi jadi tabel terpisah. Untuk sekarang, ini lebih
cepat dibangun dan cukup untuk kebutuhan yang terlihat.

### 2.6 RLS yang perlu ditambah
- `case_stages`: admin/supervisor bisa ALL, internal SELECT+UPDATE
  (status/owner), client SELECT-only (lewat `case_id` miliknya)
- `document_versions`: admin/internal INSERT+SELECT, client INSERT
  terbatas (cuma bisa nambah versi baru, gak bisa ubah versi lama —
  terhubung ke keputusan RLS role management yang sudah dibahas)
- `payments`: kolom invoice/receipt cuma bisa diisi lewat aksi sistem
  (generate invoice, verifikasi pembayaran) — bukan diedit bebas manual

---

## 3. Pembagian Kerja — Ray (Admin) vs Dimas (Client)

Kedua sisi baca/tulis ke **tabel yang sama** (§2), tapi lewat **file UI
yang beda total** — jadi bisa paralel tanpa nabrak, asal skema di §2
disepakati dan di-migrate DULUAN sebelum kedua sisi mulai bangun UI.

### 3.1 Prasyarat (harus selesai dulu, sebelum split kerja)
- [ ] Migration §2.1-2.6 dijalankan (siapa pun boleh kerjakan — sarannya
      Ray, karena sudah terbiasa pegang migration di project ini)
- [ ] Konstanta default stage per jenis layanan (§2.3) ditulis & disepakati

### 3.2 Ray — Admin Side
| Area | Deskripsi |
|---|---|
| Tab Workflow (baru) di client-detail.html | Timeline visual stage, box "Action Required", detail stage + completion conditions |
| Edit daftar stage per-case | UI tambah/hapus/reorder/ubah owner stage — cuma admin/supervisor |
| Tab Dokumen — versioning | Tampilkan riwayat versi, alasan penolakan, approve/reject dengan alasan wajib |
| Generate invoice & kuitansi | Trigger pengisian invoice_number/receipt_number di `payments` |
| Verifikasi pembayaran | (sudah ada dari modul sebelumnya, tinggal terhubung ke invoice_number) |

### 3.3 Dimas — Client Side (lanjutan dari Issue #25 yang sudah jalan)
| Area | Deskripsi |
|---|---|
| Client Dashboard | Ringkasan project, "Action Required" khusus milik client |
| Tab Workflow (versi client, read-only) | Timeline sama seperti admin, tapi tanpa kontrol edit |
| Upload dokumen + revisi | Insert ke `document_versions`, lihat alasan penolakan versi sebelumnya |
| Lihat & download invoice | Baca dari `payments` yang ada invoice_number-nya |
| Submit bukti pembayaran | Sesuai PRD Client Portal yang sudah ditulis sebelumnya |
| Lihat & download kuitansi | Baca dari `payments` yang ada receipt_number-nya |

### 3.4 Kenapa ini gak akan saling konflik
- File admin (`client-detail.html`, `src/v4/client-*.js` yang sudah ada)
  vs file client (halaman baru, terpisah total, kelanjutan dari kerja
  Dimas di Issue #25) — **tidak ada file yang disentuh dua-duanya**
- Sama-sama query ke tabel yang sama, tapi lewat query masing-masing —
  tidak saling menunggu selesai duluan
- Satu-satunya titik yang harus SELESAI DULUAN: migration §2 (prasyarat
  di atas) — setelah itu, sepenuhnya paralel

---

## 4. Yang Belum Diputuskan (perlu dibahas lagi nanti)

1. Nama-nama stage default per jenis layanan — perlu Ray tentukan
   berdasarkan alur kerja SMA yang sebenarnya (draft di dokumen asli:
   Doc Collection → Doc Verification → Processing → Payment → Final
   Delivery — apa ini sudah sesuai kenyataan, atau perlu disesuaikan?)
2. PDF generation untuk invoice & kuitansi — di luar scope dokumen ini,
   perlu dibahas terpisah (butuh library/service tambahan)
3. Bagaimana `case_stages` ini berhubungan dengan `cases.status` yang
   sudah ada (Baru/Proses/Selesai/Batal) — apakah status lama itu
   dipertahankan sebagai ringkasan level-atas, atau digantikan
   sepenuhnya oleh stage yang aktif?
