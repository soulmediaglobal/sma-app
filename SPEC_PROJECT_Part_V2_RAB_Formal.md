# Spec Tambahan: PROJECT - Part V.2 — RAB Formal (Lampiran PRD)

**Status:** Draft awal, belum diimplementasi. Dicatat 23 Agustus 2026
setelah Part V (versi dasar) selesai & merge (v2.10.0).
**Bukan revisi Part V** — ini penambahan/iterasi berikutnya. Part V
yang sudah ada (badge status, riwayat versi, termin pembayaran, total
otomatis, multi-select dokumen, gate admin/supervisor) TETAP DIPAKAI,
tidak dibongkar.

---

## Latar Belakang

Ray melihat contoh invoice formal (halaman demo `invoice.html` bawaan
Gentelella) dan minta RAB kita punya kelengkapan serupa. Ditemukan gap
konseptual: `case_quotation_items` (Part V) itu untuk **termin
pembayaran** (DP, Termin 2, dst — nama + nominal), BUKAN untuk
**rincian pekerjaan** (apa yang dikerjakan, qty, rate). Dua konsep ini
berbeda dan perlu tabel terpisah.

---

## Kelengkapan RAB Formal yang Diminta

1. Ditujukan ke siapa (data client lengkap) — **sudah ada**, dari
   `clients`
2. Nama pengajuan (jenis layanan) — **sudah ada**, `cases.service_type`
3. Tanggal pengajuan RAB — **sudah ada**, `case_quotations.created_at`
4. **Nomor RAB** — belum ada, perlu kolom baru. **DIJAWAB**: nomor
   di-generate langsung saat quotation dibuat (status DRAFT), bukan
   ditunda sampai dikirim.
5. **Deskripsi RAB (auto-generated)** — belum ada, perlu logic
   template. **DIJAWAB**: paragraf pembuka formal, lihat §Template
   Deskripsi di bawah.
6. **Detail pekerjaan gaya invoice** (deskripsi, qty, rate, amount per
   baris) — belum ada, perlu tabel baru terpisah dari termin
   pembayaran.
7. Penentuan termin pembayaran — **sudah ada** (`case_quotation_items`,
   Part V). **DIJAWAB (lihat §Total)**: termin sekarang adalah
   pembagian/alokasi dari total, bukan sumber total.
8. Nomor rekening pembayaran (rekening SMA, bukan per-case) — tampil di
   bagian bawah dokumen. **DIJAWAB**: statis, milik perusahaan bukan
   per-quotation (lihat catatan lokasi penyimpanan di bawah).
9. Detail formal lain — **DIJAWAB**: tidak ada elemen tambahan di luar
   struktur di atas (paragraf pembuka + tabel rincian pekerjaan + tabel
   termin + rekening). Struktur dokumen final:

   ```
   [Header: nomor RAB, tanggal, ditujukan ke siapa]
   [Paragraf pembuka formal — auto-generated]
   [Tabel rincian pekerjaan: deskripsi, qty, rate, amount]
   [Total (dari rincian pekerjaan)]
   [Tabel termin pembayaran: nama termin, jumlah, syarat]
   [Nomor rekening SMA]
   ```

---

## ⚠️ Perubahan Penting: Sumber Total Berubah

**Sebelumnya (Part V, v2.10.0):** `total_amount` dihitung dari jumlah
`case_quotation_items` (termin pembayaran) — itu satu-satunya sumber
angka yang ada saat itu.

**Sekarang (dijawab Ray):** total = **jumlah dari rincian pekerjaan**
(`case_quotation_line_items`, tabel baru). Termin pembayaran
(`case_quotation_items`, sudah ada) sekarang fungsinya jadi **pembagian
dari total itu** — bukan sumber independen.

**Konsekuensi teknis yang perlu ditangani saat implementasi:**
- `total_amount` di `case_quotations` perlu pindah sumber: dihitung
  dari SUM(`case_quotation_line_items.amount`), bukan lagi dari
  SUM(`case_quotation_items.amount`)
- Perlu validasi: jumlah semua termin pembayaran **harus sama** dengan
  total dari rincian pekerjaan (atau minimal tidak boleh melebihi) —
  ini validasi baru yang belum ada di Part V
- UI Part V yang sudah ada (`client-quotations.js`) perlu disesuaikan:
  termin pembayaran jadi "alokasi dari total", bukan lagi
  "penjumlahan bebas yang menentukan total"

---

## Template Deskripsi (Auto-Generated)

Draft paragraf pembuka formal, berdasarkan contoh dari Ray:

```
Sehubungan dengan permintaan yang telah diajukan oleh Pihak
[nama_client] melalui Bapak/Ibu [pic_name], dengan ini kami dari
[NAMA PERUSAHAAN] bermaksud mengajukan penawaran harga untuk layanan
[jenis_layanan] dengan rincian sebagaimana tercantum di bawah ini.
```

**Dikonfirmasi Ray (23 Agustus 2026):** nama perusahaan yang benar
adalah **"Soul Mitra Abadi"** — contoh awal Ray yang menulis "Soul
Media Abadi" adalah salah ketik.

Field yang di-auto-fill: `nama_client` (dari `clients.name`),
`pic_name` (dari `clients.pic_name`), `jenis_layanan` (dari
`cases.service_type`). Hasil auto-generate tetap bisa diedit manual
(sesuai prinsip "ada yang autofill, ada yang manual" dari Ray).

---

## Usulan Skema (draft, belum final)

### Format Nomor RAB (final, dikonfirmasi Ray)

```
SMA/{tahun-bulan, format YYYY-MM}/{kode layanan 3 huruf}/{urutan 4 digit}
Contoh: SMA/2026-08/PBG/0001
```

Slash memisahkan segmen besar (perusahaan / periode / jenis layanan /
urutan), dash dipakai di dalam segmen tahun-bulan (format ISO-style
`YYYY-MM`, familiar dan gampang dibaca) — kombinasi keduanya,
dikonfirmasi Ray.

Urutan diletakkan paling belakang (bukan setelah kode servis) supaya
pengurutan tetap kronologis per bulan, sementara kode layanan tetap
kebaca jelas di tengah nomor — tim internal bisa langsung tahu jenis
RAB dari sepintas lihat nomornya, sesuai permintaan Ray.

**Cara kerja counter — DIJAWAB (23 Agustus 2026):** nomor RAB melekat
ke SATU rangkaian negosiasi (`case_id`), bukan ke tiap baris versi.
Nomor di-generate SEKALI saat versi pertama (v1) dibuat untuk sebuah
case, lalu diwariskan ke semua versi berikutnya (v2 hasil Nego, v3,
dst) — nomornya TIDAK berubah walau statusnya berubah
(DRAFT→SENT→REJECTED→NEGOTIATING→v2 baru→...). Counter urutan cuma
naik saat rangkaian BARU dimulai (v1 untuk case yang belum pernah punya
RAB), bukan setiap kali versi baru dibuat dalam rangkaian yang sama.

Ini menghindari nomor "kebuang" akibat penolakan/negosiasi — angka
urutan secara makna jadi "berapa RAB baru yang dibuka tahun ini", bukan
"berapa baris quotation yang pernah ada". Implementasi teknis: saat
`case_quotations` versi baru (v2+) dibuat untuk case yang sudah punya
`quotation_number`, nomor itu di-copy dari versi sebelumnya, bukan
digenerate ulang.

### `service_type_codes` — TABEL BARU, pemetaan kode 3 huruf

`service_type` sekarang teks bebas (bukan enum terbatas), jadi perlu
tabel pemetaan supaya kode selalu konsisten:

| Kolom | Tipe | Keterangan |
|---|---|---|
| service_type | text | PK, harus cocok persis dengan `cases.service_type` |
| code | varchar(3) | Kode 3 huruf, uppercase |

Daftar awal (diusulkan dari 21 jenis layanan yang sudah pernah dipakai
di data existing):

```
PBG -> PBG            Izin Usaha -> IZU
SLF -> SLF             Izin Lingkungan (UKL-UPL) -> IZL
NIB -> NIB              Amdal -> AMD
Pendirian PT -> PPT     Perpanjangan NIB -> PNB
Pendirian CV -> PCV     Merek Dagang (HKI) -> HKI
Pendirian Yayasan -> PYY  BPJS Ketenagakerjaan -> BPJ
Pendirian PT + OSS -> POS  Akta Perubahan Modal -> AKT
Perubahan Alamat -> PAL  Sertifikasi Halal -> HAL
Perubahan Pengurus -> PPG  Izin Operasional -> IZO
Laporan Tahunan -> LAP   IMB ke PBG -> IMB
SIUP -> SIU
```

**Terhubung dengan backlog "Halaman Project Setting"** yang sudah
tercatat sebelumnya — pengelolaan kode layanan ini cocok jadi bagian
dari halaman itu nanti (admin bisa tambah kode untuk layanan baru
sendiri), bukan hardcode di kode program. Untuk implementasi awal
Part V.2, daftar di atas bisa di-seed langsung via migration (pola
sama seperti `document_templates` di Part IV).

### `case_quotations` — tambahan kolom

| Kolom | Tipe | Keterangan |
|---|---|---|
| quotation_number | text, nullable | Format `SMA/YYYY-MM/{kode}/{urutan}`, lihat detail di atas |
| description | text, nullable | Auto-generated dari nama client + jenis layanan, bisa diedit manual |

### `case_quotation_line_items` — TABEL BARU, rincian pekerjaan

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| quotation_id | uuid | FK ke `case_quotations` |
| description | text | Nama pekerjaan/item |
| detail | text, nullable | Sub-keterangan (contoh: "Annual subscription · 50 seats" di invoice referensi) |
| qty | numeric | |
| rate | numeric | Harga per unit |
| amount | numeric | qty × rate (dihitung, bukan diketik manual — sama prinsipnya dengan total_amount di Part V) |
| order_index | int | |

**Beda dengan `case_quotation_items` (termin pembayaran):** tabel ini
untuk "apa yang dikerjakan", `case_quotation_items` untuk "kapan/berapa
dibayar". Satu quotation bisa punya banyak baris di kedua tabel secara
independen.

### Info rekening pembayaran — perlu diputuskan lokasinya

Kemungkinan bukan per-case, tapi setting level perusahaan (SMA cuma
punya 1-beberapa rekening tetap, bukan beda-beda tiap RAB). Kandidat
lokasi:
- Tabel setting baru kecil (`company_settings` atau semacamnya)
- Atau digabung ke backlog "Halaman Project Setting" yang sudah
  tercatat sebelumnya (di luar 7-part PROJECT)

**Belum diputuskan** — perlu dibahas Ray sebelum diimplementasi.

---

## Yang Masih Perlu Dikonfirmasi

Semua terjawab (23 Agustus 2026):
1. ~~Cara kerja counter nomor~~ **DIJAWAB** — melekat per rangkaian
   negosiasi, lihat §Format Nomor RAB
2. ~~Rincian pekerjaan wajib?~~ **DIJAWAB: WAJIB.** Ini nilai utama RAB
   — tanpa rincian pekerjaan, tidak ada dasar angka total. "Buat
   Penawaran" harus divalidasi: minimal 1 baris `case_quotation_line_items`
   dan total > 0, kalau tidak tombolnya disabled (pola sama seperti
   validasi termin di Part V yang sudah ada).
3. ~~Termin vs total rincian pekerjaan tidak sama?~~ **DIJAWAB.**
   Termin pembayaran itu PEMBAGIAN dari total rincian pekerjaan — total
   rincian pekerjaan jadi BATAS ATAS (limit) saat menyusun termin.
   Kalau jumlah termin tidak sama dengan total (kurang atau lebih),
   tampilkan WARNING (tidak blocking/hard-stop), biar admin tetap sadar
   ada selisih tapi tidak dipaksa pas seratus persen kalau memang ada
   alasan (pembulatan, dsb).

---

## Bagian Baru: Preview Dokumen Formal (ditambahkan 24 Agustus 2026)

Ditambahkan setelah Part V.2 schema + trigger nomor RAB selesai
(v2.11.0 + commit d079991). Ini scope tambahan di UI Part V.2 yang
sama, bukan part terpisah.

### 3 Tombol Terpisah (bukan 1 tombol "Buat Penawaran" saja)

1. **Simpan** — simpan draft (`case_quotations` status tetap DRAFT),
   supaya bisa direview dulu sebelum dikirim. Ini yang sudah ada
   fungsinya di Part V.2 UI (auto-save saat isi form).
2. **Preview** — buka tampilan dokumen formal, latar belakang putih,
   layaknya surat resmi siap kirim (lihat struktur di bawah). BUKAN
   aksi yang mengubah status — murni tampilan/review.
3. **Kirim Penawaran** — baru di titik ini `case_quotations.status`
   berubah DRAFT → SENT. Tetap gated admin/supervisor only (RLS yang
   sudah ada, tidak berubah).

### Struktur Dokumen Preview (urutan dari atas ke bawah)

1. Tanggal pembuatan dokumen
2. Nomor RAB (`quotation_number`)
3. Jumlah lampiran (opsional untuk sekarang — didefinisikan belakangan,
   boleh dikosongkan/disembunyikan dulu di iterasi ini)
4. **Perihal:** Surat Penawaran [jenis layanan]
5. **Kepada Yth.** Bpk/Ibu [nama PIC] [jabatan PIC] — [nama perusahaan
   lengkap + tipe] — [alamat perusahaan] (semua dari `clients`)
6. Paragraf pembuka formal (template sudah ada di §Template Deskripsi
   di atas — ini `case_quotations.description`, auto-filled tapi
   editable)
7. **Tabel rincian pekerjaan** (dari `case_quotation_line_items`) —
   rapi, format tabel formal
8. **Daftar dokumen yang harus dilengkapi** — dari dokumen yang dipilih
   di multi-select (`document_templates` yang sudah dicentang, Part V)
9. **Termin pembayaran** (dari `case_quotation_items`)
10. **Rekening pembayaran SMA** — lihat §Rekening SMA (skema baru) di
    bawah
11. **Kontak** — nama & nomor HP pembuat project (`cases.created_by`
    → `profiles.name` + `profiles.phone`, lihat §Kolom Phone di bawah)
12. Kalimat penutup formal, mengarahkan ke tombol
    Terima/Tolak/Nego (tombolnya sendiri baru dibangun di Part VI —
    di preview ini cukup teksnya dulu, tombol aksi belum aktif)

### §Rekening SMA (skema baru — DIJAWAB: tabel setting terpisah)

Tabel baru kecil, bisa diisi manual via SQL sekarang, UI kelolanya
menyusul di backlog "Project Setting":

```sql
create table public.company_settings (
  key text primary key,
  value text
);
```

Diisi minimal: `bank_name`, `bank_account_number`, `bank_account_holder`
(bisa ditambah key lain kapan saja tanpa migration baru, karena
key-value).

### §Kolom Phone (skema baru — DIJAWAB: tambah ke profiles)

```sql
alter table public.profiles add column phone text;
```

Nullable — staff isi sendiri, tidak wajib retroaktif untuk semua yang
sudah ada. Kalau kosong, preview cukup tampilkan nama tanpa nomor
(bukan error).

### Implementasi Preview — Rekomendasi Teknis

Karena stack ini vanilla JS + Vite tanpa API server, cara paling
sesuai: render tampilan HTML terformat (bukan generate file PDF
beneran di server) dalam modal/tab baru dengan CSS `@media print`,
lalu manfaatkan fitur "Print to PDF" bawaan browser (`window.print()`)
kalau user memang mau simpan sebagai file PDF. Alternatif: library
client-side seperti jsPDF kalau butuh file PDF asli tanpa lewat dialog
print browser — tapi window.print() lebih ringan dan cukup untuk
kebutuhan "preview yang rapi", sesuai permintaan Ray (bukan minta file
PDF di-generate otomatis, cuma preview yang terlihat formal).

---

## Dampak ke UI yang Sudah Ada (Part V, v2.10.0)

`client-quotations.js` yang sudah dibangun perlu section baru untuk
"Detail Pekerjaan" (tabel `case_quotation_line_items`), ditambahkan
berdampingan dengan section "Termin Pembayaran" yang sudah ada — bukan
menggantikannya.

**Perilaku final (semua open question terjawab):**
- Total RAB = SUM(`case_quotation_line_items.amount`) — WAJIB diisi
  minimal 1 baris sebelum "Buat Penawaran" bisa aktif
- Termin pembayaran = pembagian dari total itu, dengan total sebagai
  batas atas. Kalau jumlah termin ≠ total rincian pekerjaan → warning
  non-blocking (bukan validasi keras)
- Nomor RAB digenerate sekali per rangkaian negosiasi (saat v1
  dibuat), diwariskan ke semua versi berikutnya (v2, v3, dst) tanpa
  pernah berubah

---

## Gap Teknis Lain yang Perlu Ditambal Bersamaan (dari Part V)

Ditemukan saat review Part V, belum diperbaiki:
- RLS `documents` tidak punya policy DELETE untuk role
  internal/supervisor (cuma admin) — fitur "uncheck dokumen untuk
  hapus" di RAB builder gagal untuk role selain admin. Perlu migration
  kecil terpisah (bisa dikerjakan kapan saja, tidak harus bersamaan
  dengan Part V.2).
