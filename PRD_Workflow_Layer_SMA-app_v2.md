# PRD: Workflow Layer v2.0 — SMA-app

**Versi:** 2.0 (Draft hasil diskusi, disepakati stakeholder — menggantikan
`PRD_Project_Intake_RAB_Workflow_SMA-app.md` v3.0 yang untuk sementara
berstatus **pending**)
**Konteks:** Hasil rapat review sistem manajemen proyek & alur kerja RAB
bersama stakeholder, ditindaklanjuti lewat sesi perumusan mekanisme detail.
Menggantikan sebagian besar alur Iniciate/Approval/Process/Finalisasi dari
PRD lama. **RAB Builder (Part V) sendiri tetap dipakai/tidak dirombak** —
yang berubah adalah proses SEBELUM dan SESUDAHNYA.
**Pembagian kerja:** Ray = Admin side (CMS internal), Dimas = Client side
(client portal, `mitra.soulmitra.id`), dikerjakan paralel.

---

## 0. Prinsip Desain

Skema `case_stages` yang sudah ada (dibangun di Issue #36, menggantikan
generic workflow-engine yang di-revert karena prosesnya miss — dibangun
duluan sebelum PRD yang menolaknya sempat terbaca) **tidak dirombak**.
Fleksibilitas yang dibutuhkan di dokumen ini ditambahkan sebagai kolom/
tabel baru dan logic kondisional yang eksplisit per kebutuhan — bukan
abstraksi generik (template/instance engine) yang mencoba menangani semua
kasus sekaligus. Pelajaran dari Issue #33 (generic-engine gagal): tambah
yang dibutuhkan secara konkret, jangan bangun mesin generik duluan.

---

## 1. Alur Besar — 4 Fase

```
INICIATE -> APPROVAL -> PROCESS (RAB Builder + Workflow eksekusi) -> FINALISASI
```

---

## 2. FASE 1 — INICIATE

### 2.1 Entry point
Case bisa dibuat dari 2 arah:
- **Client self-service**: client pilih service, lihat kebutuhan dokumen,
  upload data sendiri
- **Admin input**: admin bikin case & upload semua data langsung di sisi
  admin

### 2.2 Syarat dokumen per service
Didefinisikan di **Project Setting** (dibahas & dibangun terpisah, tapi
jadi prasyarat fase ini) — tiap `service_type` punya daftar dokumen wajib.
Data source: `document_templates.default_service_types` (sudah di-seed,
Part IV).

### 2.3 Dependency otomatis antar-service
Kalau salah satu dokumen wajib untuk suatu service adalah **output dari
service lain** yang kita sediakan (contoh: NIB adalah syarat PBG), dan
client belum punya dokumen itu:

- Sistem trigger pembuatan **case baru terpisah** untuk service prasyarat
  (mis. NIB)
- Case yang menunggu (PBG) statusnya jadi **`ON_HOLD`**, dengan referensi
  eksplisit ke case prasyaratnya
- Dependency bisa **bertingkat** (chain tanpa batas kedalaman eksplisit —
  sistem cukup cek satu tingkat ke atas tiap kali, tidak perlu tahu total
  kedalaman rantai)
- RAB untuk case prasyarat digenerate terpisah, dari nol

**Field baru:**
- `cases.status` — tambah value `ON_HOLD`
- `cases.blocked_by_case_id` — referensi ke case yang jadi prasyarat

---

## 3. FASE 2 — APPROVAL

### 3.1 Respon client terhadap RAB
Tiga opsi: **APPROVE / REJECT / NEGOTIATION**

- REJECT juga bisa di-trigger dari sisi **admin** (tidak hanya client) —
  perlu field alasan (`rejection_reason`) untuk kejelasan kenapa dibatalkan
  dari sisi internal.

### 3.2 Alur Negotiation
- Client memilih Nego dengan **satu klik saja** — **tidak ada form input
  harga atau angka yang diharapkan dari client.** Perhitungan ulang RAB
  sepenuhnya kewenangan admin, bukan sesuatu yang bisa diminta/didikte
  langsung oleh client lewat sistem (diskusi harga di luar sistem tetap
  bisa terjadi secara manual/offline, tapi tidak direkam sebagai input
  terstruktur)
- Versi RAB lama (`case_quotations`) jadi `SUPERSEDED`, tetap terlihat
  penuh di histori (tidak disembunyikan)
- Admin bikin versi baru (form kosong), tapi bisa lihat & bandingkan
  versi-versi sebelumnya untuk komparasi
- **Maksimal 3 siklus nego** per case
- Begitu limit tercapai dan RAB masih belum disepakati kedua pihak:
  **sistem otomatis set `intake_status = REJECTED`**, final
- **Tidak ada case baru dibuat otomatis oleh sistem.** Kalau client mau
  lanjut lagi nanti, itu request manual dari nol — tidak ada "warisan"
  data apapun dari case yang sudah reject

**Field baru:**
- Counter siklus nego — eksplisit sebagai kolom di `cases` (lebih cepat
  di-query dibanding hitung on-the-fly dari jumlah versi SUPERSEDED)

---

## 4. FASE 3 — PROCESS (RAB Builder + Workflow Eksekusi)

### 4.1 Struktur Step Berjenjang (saat RAB dibuat)

Admin mendefinisikan step sekaligus **sub-step**, sampai maksimal **3
level** (step → sub-step → sub-sub-step).

**Harga:**
- Item paling bawah di tiap cabang (leaf, tidak punya children) diinput
  manual oleh admin
- Item yang punya children dihitung **otomatis** sebagai sum dari
  children-nya, berlaku rekursif ke atas

**Note:**
- Secara fungsional/UI, hanya **step level 1** yang punya form note.
  Sub-step dan sub-sub-step tidak punya note terpisah.

**UX pembuatan sub-step:**
- Tiap kali admin menambah step baru, langsung tersedia opsi untuk
  menambah sub-step di bawahnya
- Kalau dikosongkan, secara sistem otomatis dianggap **tidak ada
  sub-step** (item itu langsung jadi leaf di level 1, harga input manual
  seperti biasa) — opsional secara visual, bukan wajib diisi

**Hubungan ke `case_stages`:**
- Hanya **step level 1** (item tanpa parent) yang menjadi baris di
  `case_stages` saat RAB diterima
- Sub-step / sub-sub-step **tidak** menjadi stage terpisah di Tab
  Workflow — tetap tersimpan sebagai breakdown harga, dan bisa dilihat
  lagi untuk referensi (RAB, dan nanti dokumen serah terima)

**Field baru (`case_quotation_items`):**
- `parent_item_id` (nullable) — self-reference, membentuk hierarki
- `notes` (text, nullable) — secara fungsional hanya diisi di level 1
- Validasi kedalaman maksimal 3 level — divalidasi di level aplikasi
  (bukan constraint database rekursif)

### 4.2 Termin Pembayaran ↔ Step

- Ditentukan saat RAB dibuat, bersamaan dengan penyusunan step
- Tiap termin di-link ke "harus lunas sebelum step keberapa" (step level
  1 saja)
- Jumlah step dan termin **tidak fixed** — sepenuhnya tergantung
  kesepakatan per case

**Field baru:** `required_before_stage_order` (mengacu ke `order_index`
step level 1 di `case_stages`)

### 4.3 Alur Verifikasi Pembayaran (berulang tiap termin, termasuk DP)

1. Client upload bukti transfer
2. Status jadi **`BUKTI_DIUPLOAD`** — status ini harus terlihat juga di
   sisi client, bukan hanya admin
3. Admin verifikasi:
   - **Valid** → `TERVERIFIKASI`, step yang di-block termin ini boleh
     lanjut
   - **Ditolak** → balik ke `BELUM_BAYAR`, client upload ulang bukti
4. Sengaja tidak memakai payment gateway di MVP ini — trade-off kompleksitas
   yang disadari dan diterima

**Status pembayaran per termin:** `BELUM_BAYAR → BUKTI_DIUPLOAD →
TERVERIFIKASI` (bisa balik ke `BELUM_BAYAR` kalau bukti ditolak)

### 4.4 Auto-block Step

Step otomatis berstatus **`BLOCKED`** kalau termin yang jadi syaratnya
belum `TERVERIFIKASI`. Memakai field `blocking_reason` yang **sudah ada**
di `case_stages` (kemungkinan besar memang disiapkan untuk use-case ini
sejak awal, logic otomatisnya yang baru dibangun sekarang).

Begitu termin diverifikasi (dari Tab Pembayaran), step terkait otomatis
balik ke `IN_PROGRESS`, `blocking_reason` dikosongkan.

### 4.5 Dokumen per Step

- Opsional — tidak semua step menghasilkan dokumen
- Admin bisa upload dokumen hasil kerja untuk step yang menghasilkannya,
  client bisa download
- Step tetap bisa ditandai selesai **tanpa** upload dokumen apapun

### 4.6 Batasan Alur

- **Step tidak bisa mundur** — sekali maju, tidak ada revisi balik ke
  step sebelumnya (nego ulang RAB juga sudah dibatasi di Fase 2)
- **Perlu notifikasi ke client** setiap kali status step berubah atau ada
  dokumen baru diupload (mekanisme notifikasi detail belum dibahas)

### 4.7 Siapa Bisa Apa di Tab Workflow

- **"Tandai Selesai" step + upload dokumen**: dibatasi ke user yang
  ter-assign ke case tersebut (`case_assignees`)
- **Tidak ada edit/tambah/hapus/reorder step setelah RAB diterima** —
  ini sengaja tetap tertutup (konsisten dengan Issue #40 lama) untuk
  menghindari celah manipulasi dan menjaga UX tetap sederhana
- **Assign / un-assign user ke project**:
  - Bisa dilakukan kapan saja selama project berjalan (bukan hanya saat
    pembuatan), termasuk **add dan remove**
  - Yang berwenang: **hanya Project Creator** (`cases.created_by`) — bukan
    admin/supervisor secara umum, bukan konsep "PIC" terpisah
  - **Ini fitur baru yang UI-nya belum ada sama sekali** — skema
    `case_assignees` sudah ada dari Part III, tapi belum tersambung ke
    frontend manapun

---

## 5. FASE 4 — FINALISASI

**Trigger:** admin klik tombol setelah semua step selesai dan termin
terakhir lunas.

**Isi dokumen serah terima:**
- Ringkasan project: tanggal mulai, tanggal finalisasi (timestamp saat
  tombol diklik)
- Daftar proses/step yang dilakukan (dengan breakdown sub-step bila
  diperlukan untuk detail)
- Tanggal pembayaran tiap termin + nomor invoice & kuitansi
  (`invoice_number`/`receipt_number`, kolom sudah ada di `payments`)
- Daftar dokumen yang diserahkan sepanjang project
- Nama PIC/staff yang menangani (dari `case_assignees`)
- Nomor referensi/ID dokumen unik

**Pengganti tanda tangan digital** (karena tidak memakai e-signature
resmi):
- Checkbox/tombol konfirmasi dari client + timestamp + IP tercatat
  sebagai jejak persetujuan — pola serupa dengan consent T&C di Fase 2
- **Status: belum final.** Perlu didefinisikan lebih lanjut di sesi
  terpisah — placeholder mekanisme untuk saat ini.

---

## 6. Fitur per Step — Detail UI

### 6.1 Sisi Admin (Tab Workflow, `client-detail.html`)

| Status Step | Yang terlihat | Aksi yang tersedia |
|---|---|---|
| `PENDING` | Abu-abu/nonaktif, urutan & preview note (kalau ada) | Tidak ada aksi |
| `IN_PROGRESS` | Badge "Sedang Berjalan" | Tandai Selesai (dengan/tanpa dokumen), upload dokumen, lihat/edit note |
| `BLOCKED` | `blocking_reason` ditampilkan jelas, status pembayaran termin terkait | Tidak ada aksi langsung di sini — verifikasi pembayaran dilakukan di Tab Pembayaran, bukan duplikat di Tab Workflow |
| `COMPLETED` | Tanggal selesai, dokumen (bila ada), note — kemungkinan collapsed, bisa di-expand | — |

### 6.2 Sisi Client (client portal)

Prinsip: **read-only total**, tidak ada aksi edit ke step manapun.

- Daftar step + status (Belum Mulai / Sedang Berjalan / Menunggu
  Pembayaran / Selesai)
- Kalau `BLOCKED` karena termin: pesan jelas + link langsung ke halaman
  upload bukti transfer bila belum upload
- Kalau `COMPLETED` dan ada dokumen: tombol download
- Progress bar/ringkasan keseluruhan (contoh: "3 dari 6 tahap selesai")

---

## 7. Pembagian Kerja

### 7.1 Shared / Blocking (harus selesai atau disepakati duluan)

- Migration skema lengkap: `cases` (`ON_HOLD`, `blocked_by_case_id`,
  counter nego), `case_quotation_items` (`parent_item_id`, `notes`),
  termin (`required_before_stage_order`), status pembayaran termin,
  skema dokumen serah terima
- RLS policies untuk semua tabel/kolom baru
- Project Setting (dependency antar-service) — prasyarat Fase 1

Disarankan Ray kerjakan lebih dulu (pola project ini: Ray pegang
planning/SQL/security), baru Dimas mulai menyambungkan UI client begitu
skema stabil.

### 7.2 Sisi Admin (Ray) — CMS internal

**Fase 1:** Trigger deteksi dependency saat input project, UI status
`ON_HOLD` + referensi case terkait.

**Fase 2:** UI histori versi RAB (komparasi), tombol Reject dari admin,
counter nego + auto-reject di limit.

**Fase 3:**
- RAB Builder (Part V) — form step + sub-step 3 level, harga auto-sum,
  note per step, linkage termin↔step
- Tab Workflow — baca `case_stages`, tampilkan status/`blocking_reason`,
  tombol Tandai Selesai + upload dokumen (dibatasi `case_assignees`)
- Verifikasi pembayaran (Tab Pembayaran) — terima/tolak bukti transfer
- UI assign/un-assign user ke project (dibatasi `cases.created_by`) —
  fitur baru, belum ada UI-nya sama sekali

**Fase 4:** Tombol trigger + generate isi dokumen serah terima.

### 7.3 Sisi Client (Dimas) — client portal

**Fase 1:** Form self-service bikin project, lihat kebutuhan dokumen,
upload dokumen, notifikasi status bila terkena dependency.

**Fase 2:** Halaman lihat RAB masuk, tombol Approve/Reject/Nego (Nego
murni satu klik, tanpa form input harga), indikator sisa kesempatan
nego.

**Fase 3:** Tampilan Workflow read-only (progress bar, status, pesan
`BLOCKED`), upload bukti transfer + lihat status verifikasi, download
dokumen per step.

**Fase 4:** Lihat/download dokumen serah terima, tombol konfirmasi
(checkbox + timestamp + IP).

### 7.4 Titik yang Butuh Sinkronisasi Ketat

Kontrak berikut (nama field, format response, status enum) harus
disepakati dulu sebelum dua sisi mulai ngoding independen:

1. Status pembayaran termin (`BELUM_BAYAR/BUKTI_DIUPLOAD/TERVERIFIKASI`)
   — 1 sumber kebenaran, admin verifikasi & client lihat status yang sama
2. Status step & `blocking_reason` — admin update, client baca real-time
3. Format response nego (histori versi, counter tersisa)
4. Struktur data dokumen serah terima — Dimas butuh tahu bentuk data
   persis untuk halaman lihat/download di sisi client

---

## 8. Ringkasan Field/Entitas Baru (belum final skema, untuk migration)

- `cases`: tambah status `ON_HOLD`, kolom `blocked_by_case_id`, kolom
  counter nego
- `case_quotation_items`: tambah `parent_item_id` (hierarki 3 level),
  `notes`
- Termin (bagian dari `case_quotations`/`case_quotation_items`): tambah
  `required_before_stage_order`
- `case_stages`: struktur tidak berubah (tetap 1 level, diisi dari step
  level 1 RAB); `blocking_reason` yang sudah ada dipakai untuk auto-block
- Status pembayaran per termin: enum baru
  `BELUM_BAYAR/BUKTI_DIUPLOAD/TERVERIFIKASI`
- Dokumen serah terima: entitas baru, skema belum dibahas detail
- Notifikasi: belum dibahas detail (siapa dapat apa, lewat channel apa)
- `case_assignees`: skema sudah ada (Part III), UI assign/un-assign
  belum ada sama sekali — perlu dibangun dari nol

---

## 9. Open Items (belum final, perlu sesi lanjutan)

1. Mekanisme notifikasi ke client (channel: in-app? email? keduanya?)
2. Detail skema & tampilan dokumen serah terima
3. Mekanisme pengganti tanda tangan digital — checkbox+timestamp+IP
   diusulkan sebagai baseline MVP, tapi kekuatan hukumnya perlu
   dipertimbangkan lebih lanjut oleh Ray
4. Project Setting (dependency antar-service, mapping dokumen wajib per
   service_type) — dibahas di sesi terpisah, tapi jadi prasyarat Fase 1
   di dokumen ini
5. Detail RLS presisi untuk semua tabel/kolom baru di atas

---

## Catatan Proses

- PRD ini disepakati stakeholder menggantikan sebagian besar alur
  Iniciate/Approval/Process/Finalisasi dari
  `PRD_Project_Intake_RAB_Workflow_SMA-app.md` v3.0, yang untuk sementara
  berstatus pending.
- RAB Builder (Part V) sendiri tetap dipakai — tidak dirombak, hanya
  proses sebelum (Iniciate/Approval) dan sesudahnya (Process eksekusi/
  Finalisasi) yang dirancang ulang.
- Disusun dari sesi diskusi mekanisme point-by-point antara Ray dan
  Claude, berdasarkan hasil rapat review bersama stakeholder (rekaman
  ringkasan meeting terlampir terpisah).
