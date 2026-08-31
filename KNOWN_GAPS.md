# KNOWN_GAPS.md

> Daftar gap arsitektur, keputusan yang ditunda, atau area belum diputuskan resmi untuk **SMA-app**.
> Ini **bukan** dokumen governance/rules — lihat `DEVELOPMENT_RULES.md` untuk itu.
> Ini juga **bukan** pengganti GitHub Issues — item di sini yang sudah siap dikerjakan sebaiknya dipindahkan jadi Issue resmi.
> Dikelola oleh Mike, diisi/diupdate atas persetujuan Ray.

Setiap entri dicatat supaya tidak hilang ditelan chat history, dan supaya tidak ada yang secara tidak sengaja mengerjakan ulang investigasi yang sudah pernah dilakukan.

Format entri: **Status** (`Open` / `Deferred` / `Resolved`), **Ditemukan**, **Deskripsi**, **Keputusan saat ini**.

---

## 1. RLS tabel `clients` tidak mencakup role `supervisor`

- **Status**: Open
- **Deskripsi**: Row Level Security policy pada tabel `clients` saat ini hanya mencakup role `admin`, `internal`, dan `client` — tidak ada policy untuk `supervisor`, sehingga role tersebut tidak bisa mengakses data client sama sekali.
- **Keputusan saat ini**: Belum diputuskan. Perlu ditentukan apakah `supervisor` seharusnya punya akses (dan sebesar apa) ke tabel ini.

---

## 2. Client bisa self-register via Google OAuth tanpa invite

- **Status**: Open
- **Deskripsi**: Jalur login client via Google OAuth tidak melakukan pengecekan invite-only. Siapa pun dengan akun Google bisa login dan mendapat profile baru dengan role `client`, tapi `client_id`-nya tidak otomatis terhubung ke data client manapun (akun "mengambang").
- **Keputusan saat ini**: Belum diputuskan apakah ini disengaja (self-service awal, link manual belakangan) atau perlu dibatasi lewat validasi tambahan.

---

## 3. Rencana "supervisor setara admin penuh"

- **Status**: Deferred
- **Deskripsi**: Sempat direncanakan supervisor punya akses setara admin di seluruh menu (termasuk Project Setting dan User Management). Audit awal RLS policy yang membatasi ke admin sempat dimulai.
- **Keputusan saat ini**: Ditunda karena keterbatasan waktu, bukan dibatalkan. Solusi sementara yang sudah dijalankan: satu akun tertentu diubah manual dari `supervisor` ke `admin` lewat User Management sebagai jalan pintas — bukan solusi permanen untuk rencana ini.

---

## 4. `CLIENT_PORTAL_BASE_URL` belum pernah di-set di production

- **Status**: Open
- **Deskripsi**: Environment variable ini diperlukan oleh alur invite/reset password client portal, tapi belum pernah di-set di production sejak fitur terkait pertama kali dibuat. Ini bukan regresi dari perubahan manapun — gap konfigurasi yang sudah ada sejak awal, baru terdeteksi belakangan.
- **Keputusan saat ini**: Domain client portal (`mitra.soulmitra.id`) sengaja belum diaktifkan di production — keputusan sadar Ray, menunggu domain routing siap. `CLIENT_PORTAL_BASE_URL` baru perlu diisi dengan domain final begitu itu dieksekusi.

---

## 5. Inkonsistensi kecil di `changelog.md`

- **Status**: Open (prioritas rendah)
- **Deskripsi**: Beberapa entry versi tertahan di bawah header "Unreleased" yang belum di-rename, ada versi tanpa entry changelog sama sekali, dan satu versi yang kemungkinan tergabung ke header lain akibat proses rename sebelumnya.
- **Keputusan saat ini**: Murni soal kerapian dokumentasi, tidak memengaruhi fungsi aplikasi. Bisa dirapikan kapan saja tanpa buru-buru.

---

*Dokumen ini masih berstatus DRAFT — item di atas diadopsi secara basic dari ringkasan sesi kerja sebelumnya, kemungkinan perlu detail tambahan atau verifikasi ulang sebelum masing-masing dipindah jadi GitHub Issue resmi.*
