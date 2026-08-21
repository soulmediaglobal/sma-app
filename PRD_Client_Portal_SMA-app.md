# PRD: Client Self-Service Portal — SMA-app

**Versi:** 1.0 (Draft — belum dicocokkan dengan kode Dimas yang sudah ada)
**Tanggal:** 21 Agustus 2026
**Status:** Draft untuk review bareng Ray & Dimas
**Bagian dari:** SMA-app roadmap item #8 dari 10 modul besar

---

## 1. Ringkasan & Latar Belakang

Client Self-Service Portal adalah modul yang memberi **client** (bukan
staf) akses langsung dan terbatas ke data project mereka sendiri —
tanpa perlu terus-menerus tanya progress lewat WA ke staf SMA. Modul ini
awalnya direncanakan jadi roadmap item ke-8 (setelah modul-modul lain),
tapi dipercepat karena Dimas sudah proaktif mulai membangun versi awalnya
secara mandiri (lihat Issue #25 di GitHub).

Modul ini melengkapi Client Management (modul #2, sudah selesai/v2.0.0)
dari sisi sebaliknya: kalau Client Management itu "cara staf mengelola
data client", Client Portal ini "cara client berinteraksi dengan data
mereka sendiri".

### Kenapa ini penting buat problem statement awal
Salah satu sumber potensi revenue hilang yang disebut di awal project ini
adalah status yang gak jelas dan follow-up yang lambat. Portal ini
langsung menyerang dua hal itu: client bisa cek progress sendiri
(gak perlu nunggu staf balas WA), dan client bisa upload dokumen langsung
begitu mereka siap (gak nunggu dikirim manual lalu staf upload-in).

---

## 2. Tujuan

1. Mengurangi beban staf menjawab pertanyaan repetitif soal status
2. Mempercepat pengumpulan dokumen — client upload langsung, bukan lewat
   perantara WA + upload manual staf
3. Kasih transparansi ke client soal status project dan kondisi
   pembayaran mereka
4. Buka jalur masuk client yang fleksibel — baik diundang staf, maupun
   daftar sendiri lewat link publik

---

## 3. Persona

### 3.1 Client (fokus utama modul ini)
Pemilik/perwakilan badan usaha yang jadi client SMA. Kemungkinan besar
gak terlalu teknis, akses dari HP lebih sering daripada desktop. Butuh:
lihat status project mereka, upload dokumen yang diminta, lihat total
tagihan & submit bukti bayar.

### 3.2 Admin/Internal (persona sekunder di modul ini)
Tetap yang megang kontrol penuh — verifikasi dokumen yang di-upload
client, verifikasi bukti pembayaran, dan yang generate checklist dokumen
apa aja yang dibutuhkan (client cuma mengisi, bukan menentukan sendiri
dokumen apa yang diperlukan).

---

## 4. Dua Jalur Masuk Client

### 4.1 Jalur 1 — Diundang Admin
Perluasan dari sistem invite yang sudah ada (mirip cara staf diundang):
1. Admin buka halaman Detail Client, klik "Invite Client User"
2. Masukin email orang yang mau diundang
3. Sistem invite via Supabase Auth dengan role `client`, `client_id`
   otomatis terhubung ke row `clients` yang sedang dibuka
4. Client terima email undangan, klik link, set password/login pertama
   kali
5. Setelah itu, client login pakai magic-link/OTP normal (sama seperti
   staf), langsung lihat data yang terhubung ke `client_id` mereka

### 4.2 Jalur 2 — Daftar Mandiri
Jalur baru sepenuhnya secara teknis, karena Supabase Auth kita sekarang
di-set `shouldCreateUser: false` untuk mencegah pendaftaran bebas. Client
portal butuh halaman terpisah dengan setting berbeda (`shouldCreateUser:
true` khusus halaman ini saja, TIDAK mengubah halaman login staf).

Alur: `/client-register.html` → isi nama, nama badan usaha, email → akun
dibuat dengan role `client` → **[lihat keputusan desain di bawah]** untuk
row `clients` yang terhubung.

### 4.3 Keputusan desain: reconciliation data self-register

**Rekomendasi MVP:** self-register **selalu membuat row `clients` baru**
(kosong/minimal, cuma nama + email dari form register). Staf **cek
manual** secara berkala (misal via Client List, filter "Belum ada
project") apakah ada client baru yang perlu digabung/dicocokkan dengan
data yang sudah ada. Ini paling simpel untuk MVP, dan volume pendaftaran
client kemungkinan besar masih rendah (belum butuh otomasi pencocokan).

*Alternatif yang dipertimbangkan tapi tidak dipilih untuk MVP:*
- Cocokkan otomatis berdasarkan domain email — berisiko salah cocok
  (banyak orang pakai email pribadi/Gmail, bukan email perusahaan)
- Self-register butuh kode undangan dari admin — ini sebenarnya
  menghilangkan sifat "mandiri"-nya, jadi bertentangan dengan keputusan
  Ray bahwa jalur ini harus benar-benar bebas

**Catatan:** ini keputusan MVP, bisa direvisit begitu ada data pemakaian
nyata soal seberapa sering terjadi duplikasi.

---

## 5. Model Data

### 5.1 Tabel yang sudah ada, dipakai ulang
- `clients` — row per badan usaha (sudah ada dari modul #2)
- `profiles` — sudah punya kolom `role` dan `client_id`, tidak perlu
  perubahan struktur

### 5.2 Perubahan yang dibutuhkan

**Tabel `payments` — tambah kolom:**
| Kolom baru | Tipe | Keterangan |
|---|---|---|
| `proof_url` | text, nullable | Link bukti transfer yang di-upload client |

**Kenapa bukan client yang ubah `status`/`paid_at` langsung:** itu tetap
harus jadi keputusan staf (verifikasi bukti transfer dulu, baru staf yang
tandai Lunas) — client cuma **submit bukti**, bukan **menyatakan diri
sudah lunas**. Ini jaga integritas data finansial.

### 5.3 RLS baru yang dibutuhkan (migration terpisah)
RLS untuk role `client` **saat ini cuma SELECT** di semua tabel. Perlu
ditambah:
- `clients`: UPDATE terbatas — client cuma bisa update kolom kontak
  mereka sendiri (bukan npwp/nib/data legal yang butuh verifikasi staf),
  dibatasi `id = auth_client_id()`
- `documents`: UPDATE terbatas — client cuma bisa isi/ubah `file_url`
  pada dokumen yang **sudah ada** (dibuat staf sebagai checklist),
  dibatasi lewat `case_id` yang `client_id`-nya cocok. **Client TIDAK
  bisa membuat jenis dokumen baru sendiri** — itu tetap kontrol staf,
  biar checklist-nya konsisten dengan kebutuhan compliance/legal.
- `payments`: UPDATE terbatas — client cuma bisa isi kolom `proof_url`
  baru, TIDAK BISA mengubah `status`/`paid_at`/`amount`
- `cases`: tetap read-only (SELECT saja) — client lihat progress, tidak
  bisa mengubah status project mereka sendiri

---

## 6. Fitur & Cara Kerja

### 6.1 Halaman Register (`client-register.html`)
Form sederhana: nama lengkap, nama badan usaha, email, password (atau
langsung OTP-based tanpa password, konsisten dengan pola staf — perlu
diputuskan). Submit → bikin `profiles` row role `client` + `clients` row
baru terhubung.

### 6.2 Halaman Login Client
Bisa jadi halaman terpisah dari login staf (`client-login.html`), atau
satu halaman yang redirect otomatis berdasarkan role setelah OTP
tervalidasi. **Rekomendasi: terpisah** — biar gak membingungkan (client
gak perlu tahu ada dunia "staf" di app yang sama), dan biar
`shouldCreateUser` bisa diset beda per halaman tanpa saling mengganggu.

### 6.3 Dashboard Client
Ringkasan project mereka: daftar project (dari `cases` mereka), status
tiap satu, checklist dokumen yang masih kurang, ringkasan tagihan.

### 6.4 Upload Dokumen (sisi client)
Client lihat checklist dokumen (dibuat staf lewat Tab Dokumen di sisi
admin), isi/update link file per dokumen yang statusnya "Belum". Begitu
link terisi, status otomatis jadi "Upload" — **pola ini sudah ada** dari
Issue #24 (auto-sync status berdasarkan keberadaan link), tinggal dibuka
aksesnya untuk role `client` juga lewat RLS baru di atas.

### 6.5 Lihat Progress Project
Read-only — list `cases` milik client, status masing-masing (Baru/
Proses/Selesai/Batal), tanpa bisa ubah apapun.

### 6.6 Info Pembayaran
Lihat Total RAB / Total Dibayar / Sisa Piutang (sama seperti tampilan
staf, tapi read-only + tombol "Upload Bukti Transfer" per termin yang
statusnya Pending. Upload bukti **tidak otomatis mengubah status ke
Lunas** — itu tetap staf yang verifikasi dan tandai manual.

---

## 7. Role & Permission Matrix

| Aksi | Admin | Internal | Client |
|---|---|---|---|
| Lihat semua client | ✅ | ✅ | ❌ (cuma data sendiri) |
| Lihat project/case sendiri | - | - | ✅ (read-only) |
| Update kontak client sendiri | ✅ | ✅ | ✅ (terbatas, bukan data legal) |
| Isi/ubah link dokumen sendiri | ✅ | ✅ | ✅ (dokumen yang sudah dibuat staf) |
| Buat jenis dokumen baru | ✅ | ✅ | ❌ |
| Verifikasi/tolak dokumen | ✅ | ✅ | ❌ |
| Upload bukti transfer | - | - | ✅ (kolom `proof_url` saja) |
| Tandai pembayaran Lunas | ✅ | ✅ | ❌ |
| Ubah status project | ✅ | ✅ | ❌ |

---

## 8. Alur Kerja Utama (User Flows)

**Alur A — Client diundang staf, upload dokumen pertama kali:**
1. Admin bikin project baru untuk client + checklist dokumen yang
   dibutuhkan (lewat sisi admin, modul yang sudah ada)
2. Admin invite client (§4.1)
3. Client terima undangan, set password, login
4. Client lihat checklist dokumen "Belum", isi link satu per satu
5. Staf dapat notifikasi/lihat dokumen berstatus "Upload", verifikasi

**Alur B — Client daftar mandiri sebelum ada kontak dengan staf:**
1. Client buka `client-register.html`, isi data, daftar
2. Row `clients` baru otomatis terbuat (kosong, cuma dari form register)
3. Staf, di sisi lain, lihat ada client baru tanpa project — follow up
   manual (telepon/WA) untuk mulai proses seperti biasa

**Alur C — Submit bukti pembayaran:**
1. Client buka Info Pembayaran, lihat termin yang Pending
2. Klik "Upload Bukti Transfer", isi link bukti (Drive/gambar)
3. `proof_url` tersimpan, status tetap Pending
4. Staf lihat ada bukti baru masuk, verifikasi manual, baru tandai Lunas

---

## 9. Validasi & Edge Case

- Email yang dipakai daftar mandiri harus valid (validasi dasar format)
- Kalau email yang dipakai daftar mandiri ternyata sama dengan email PIC
  yang sudah ada di suatu row `clients` — sistem TIDAK otomatis
  menggabungkan (lihat §4.3), staf yang cek manual
- Client tidak bisa lihat/akses data client lain sama sekali (dijamin
  RLS, bukan cuma UI hiding)
- Upload bukti transfer kosong/link tidak valid — validasi format
  URL http/https (pola yang sama seperti validasi link dokumen di §6.4)

---

## 10. Non-Functional Requirements

- Halaman client harus mobile-friendly (kemungkinan besar diakses dari
  HP, bukan desktop)
- Bahasa tetap Bahasa Indonesia, konsisten dengan sisi admin
- Visual tetap pakai komponen Gentelella yang sudah ada, tapi mungkin
  perlu shell/sidebar yang lebih sederhana (client tidak butuh
  navigasi sekompleks staf — cuma Dashboard, Dokumen, Pembayaran)

---

## 11. Metrik Keberhasilan

- Berkurangnya volume pertanyaan "gimana progress saya?" lewat WA ke staf
- Waktu rata-rata dari "dokumen diminta" ke "dokumen ter-upload" makin
  cepat dibanding alur manual sebelumnya
- Ada client yang berhasil daftar mandiri tanpa perlu diundang staf dulu

---

## 12. Di Luar Scope (untuk saat ini)

- Notifikasi email/WA otomatis ke client (misal "dokumen Anda sudah
  terverifikasi") — belum ada infrastruktur notifikasi di luar Resend
  buat OTP
- Chat/pesan langsung antara client dan staf di dalam app
- Client bisa lihat riwayat aktivitas (Tab Aktivitas versi staf) — belum
  diputuskan apakah client perlu lihat log serinci itu atau cukup status
  ringkas saja

---

## 13. Open Questions (perlu diputuskan Ray + Dimas)

1. Login client pakai magic-link/OTP (konsisten sama staf), atau
   password based (lebih umum buat portal publik-facing)?
2. Halaman login client terpisah total dari login staf, atau satu
   halaman yang pintar deteksi role?
3. Apakah perlu ada semacam "klaim akun" — kalau ternyata email
   self-register match sama PIC yang sudah ada di `clients`, kasih
   staf tombol "Gabungkan" alih-alih manual edit database?
4. **Yang paling penting:** bandingkan dokumen ini sama kode yang
   Dimas udah bangun di Issue #25 — bagian mana yang sudah cocok,
   bagian mana yang beda pendekatannya dan perlu didiskusikan ulang.
