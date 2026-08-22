# PRD: Project Intake & RAB Workflow — SMA-app (DRAFT)

**Status:** Draft, disetujui sementara oleh Ray (22 Agustus 2026) — "oke
dulu, nanti sambil kita lihat hasilnya begitu ada visualnya". BELUM
final, revisi diperkirakan terjadi setelah UI/prototype pertama
kelihatan. Belum ada kode/migration yang dibuat dari dokumen ini.

**Konteks:** Perluasan alur Project — dari sekadar isi service_type +
RAB manual, jadi alur intake lengkap: pilih layanan → assign tim →
tentukan dokumen awal → generate RAB → penawaran ke client →
Terima/Tolak/Nego → baru masuk Workflow.

**Catatan penting dari Ray:** semua 6 tab di Client Detail (Info,
Project, Workflow, Dokumen, Pembayaran, Aktivitas) kemungkinan besar
akan kena redesign visual & struktural begitu alur ini diimplementasi.
Ini disengaja/diterima, bukan side-effect yang tidak diinginkan — tujuan
akhirnya proses jadi jelas baik untuk internal maupun client.

---

## 1. Alur Besar

```
[Buat Project Baru]
       |
       +- Pilih jenis layanan (service_type)
       +- Assign tim internal (1..N staff, pakai case_assignees yang
       |  sudah ada di database, belum ada UI-nya)
       +- Tentukan dokumen awal dibutuhkan (pilih dari master, bukan
       |  ketik manual)
       +- Catatan
       +- Generate RAB (rincian biaya + termin + syarat tiap termin)
       |
       v
[Klik "Buat Penawaran"]
       |
       v
status project: "Menunggu Persetujuan Client"
       |
       v
[Client lihat penawaran di dashboard-nya]
       |
       +- TERIMA --------> RAB di-lock, payments ter-generate dari
       |                    termin, case_stages mulai (Workflow aktif)
       |
       +- TOLAK ---------> project selesai di sini, Workflow tidak
       |                    diproses
       |
       +- NEGO ----------> balik ke admin, RAB bisa diedit ulang, kirim
                            ulang penawaran (looping ke atas)
```

**Titik penting:** `case_stages` (Workflow) TIDAK langsung ada begitu
project dibuat — baru di-generate begitu client TERIMA. Ini beda dari
kondisi sekarang (per 22 Agustus 2026), di mana `case_stages` baru saja
di-seed untuk SEMUA project (42 project: 15 lama + 27 baru) langsung
tanpa lewat tahap penawaran. Lihat §6 untuk rencana rekonsiliasi.

---

## 2. Skema Data Baru (usulan, belum dibuat)

### 2.1 `document_templates` — master jenis dokumen

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| name | text | "KTP Direktur", "NPWP Perusahaan", dst |
| category | text, nullable | Pengelompokan (Identitas, Legalitas, Keuangan, dst) |
| default_service_types | text[], nullable | Jenis layanan yang biasanya butuh dokumen ini (auto-suggest) |
| is_active | boolean | Bisa dinonaktifkan tanpa hapus riwayat |
| created_at | timestamptz | |

Saat admin pilih "dokumen awal dibutuhkan" di project, pilih dari sini
(multi-select), bukan ketik nama sendiri. Baris `documents` untuk
project itu ambil `name` dari template yang dipilih.

### 2.2 `case_quotations` — RAB / penawaran (header)

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| case_id | uuid | FK ke `cases` |
| version | int | Mulai dari 1, naik tiap kali Nego (riwayat semua versi tersimpan) |
| status | text | DRAFT / SENT / ACCEPTED / REJECTED / NEGOTIATING / SUPERSEDED |
| total_amount | numeric | Total keseluruhan (dihitung dari items) |
| notes | text, nullable | Catatan/syarat umum penawaran |
| sent_at | timestamptz, nullable | Kapan dikirim ke client |
| responded_at | timestamptz, nullable | Kapan client Terima/Tolak/Nego |
| client_response_notes | text, nullable | Kalau Nego, alasan/permintaan client |
| created_by | uuid, FK profiles | |
| created_at | timestamptz | |

Versioned (bukan update in-place) supaya riwayat negosiasi kelihatan
(v1 ditolak alasan X, v2 direvisi, v3 diterima).

### 2.3 `case_quotation_items` — rincian termin dalam 1 RAB

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| quotation_id | uuid | FK ke `case_quotations` |
| term_name | text | "DP", "Termin 2", "Pelunasan", dst |
| amount | numeric | |
| due_condition | text | Syarat pencairan termin ini |
| order_index | int | Urutan tampil |

Begitu `case_quotations.status = ACCEPTED`, sistem generate baris di
`payments` (yang sudah ada) dari `case_quotation_items` ini — 1
quotation item jadi 1 payment row berstatus `Pending`.

### 2.4 Kolom baru di `cases`

| Kolom | Tipe | Keterangan |
|---|---|---|
| intake_status | text | DRAFT / QUOTED / ACCEPTED / REJECTED — status di level intake, terpisah dari `status` (Baru/Proses/Selesai/Batal) yang menggambarkan progress operasional setelah diterima |

Dipisah dari `cases.status` yang sudah ada supaya trigger
`sync_case_status_from_stages` (Issue #38) yang sudah dibangun tidak
perlu dirombak — `intake_status` jadi gerbang sebelum `case_stages`
mulai ada isinya.

---

## 3. State Machine — Terima / Tolak / Nego

```
DRAFT --(kirim)--> SENT --(client Terima)--> ACCEPTED
                     |                          |
                     |                          +--> trigger: generate
                     |                               payments dari
                     |                               quotation_items +
                     |                               seed case_stages
                     |
                     +--(client Tolak)--> REJECTED (Workflow tidak
                     |                     pernah dibuat)
                     |
                     +--(client Nego)--> NEGOTIATING --(admin revisi)-->
                                          versi baru (v2), quotation
                                          lama jadi SUPERSEDED
```

---

## 4. Yang Perlu Disinkronkan ke Dimas

- Client butuh halaman baru: "Penawaran Menunggu Persetujuan" — list
  quotation berstatus SENT, tombol Terima/Tolak/Nego
- RLS `case_quotations` perlu policy client_select_own + kemampuan
  UPDATE status jadi ACCEPTED/REJECTED/NEGOTIATING — ini pertama
  kalinya client butuh WRITE access ke sesuatu selain upload bukti
  bayar
- "Bisa di-trigger dari sisi client" (request layanan baru dari client
  sendiri) kemungkinan besar tumpang tindih dengan Issue #25 (Client
  Self-Service Portal) — perlu dibahas siapa bangun bagian mana

---

## 5. Dampak ke Fitur yang Sudah Ada

| Fitur existing | Dampak |
|---|---|
| Tab Project (`client-detail.js`) | Form "Tambah Project" jadi wizard multi-step (layanan -> tim -> dokumen -> RAB) |
| Tab Pembayaran (`client-payments.js`) | Perlu bagian baru menampilkan RAB/quotation, bukan cuma payment yang sudah jalan |
| Tab Workflow (baru selesai disambungkan ke data real per 22 Agustus 2026) | `case_stages` seharusnya baru muncul setelah `intake_status = ACCEPTED` — benturan dengan seed data yang sudah dimasukkan (lihat §6) |
| Menu "Transaksi" (akan direvisi total menurut Ray) | Kemungkinan jadi tempat lihat semua `case_quotations` lintas client |

---

## 6. Rekonsiliasi Data Existing

42 project (15 lama + 27 seed baru per 22 Agustus 2026) sudah punya
`case_stages` tanpa pernah lewat tahap penawaran. Opsi: treat semua 42
sebagai `intake_status = ACCEPTED` secara retroaktif (generate 1
`case_quotation` dummy per project, status ACCEPTED) — supaya data lama
tetap valid di bawah model baru, tidak perlu dihapus/direset.

---

## 7. Open Questions

1. Saat client NEGO, apakah RAB versi lama (v1) masih terlihat client
   sambil menunggu revisi, atau disembunyikan sampai v2 siap?
2. Apakah `document_templates` otomatis terkait ke `service_type`
   (pilih PBG -> auto-suggest dokumen wajib), atau full manual tiap
   kali?
3. Kalau client belum respon lama — ada auto-reminder/expiry untuk
   quotation yang SENT?
4. `case_assignees` — assign tim terikat ke project (per case_id) saja,
   atau bisa diubah di tengah jalan tanpa lewat proses intake ini?
5. Siapa yang approve RAB dari sisi internal sebelum dikirim ke client
   — butuh approval supervisor/admin, atau internal bisa kirim langsung?

---

## Catatan proses (bukan bagian PRD, log diskusi)

- 22 Agustus 2026, pagi: draft ditulis Claude berdasarkan penjelasan
  lisan Ray soal alur intake -> RAB -> approval -> workflow.
- Ray review: "harusnya udah sih... sementara gw oke dulu, nanti sambil
  kita lihat hasilnya" — disetujui sebagai arah, BUKAN sebagai spec
  final siap-implementasi. Revisi diperkirakan muncul begitu ada
  visual/prototype pertama.
- Belum ada Issue GitHub yang dibuat untuk PRD ini. Belum ada migration
  yang dijalankan. Tab Workflow yang sudah disambungkan ke data real
  (Issue #40) TETAP DIPERTAHANKAN apa adanya sampai ada keputusan
  eksplisit untuk merombaknya sesuai PRD ini.
