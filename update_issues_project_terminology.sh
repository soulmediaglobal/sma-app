#!/bin/bash
# ============================================================
# Update issue #6, #8, #9 — ganti istilah "Case" jadi "Project"
# di judul & deskripsi (bukan di nama tabel/kolom database).
# ============================================================

REPO="soulmediaglobal/sma-app"

echo "Updating issue #6, #8, #9 di $REPO ..."

# ---------- Issue 6 ----------
cat > /tmp/i6.md << 'EOF'
**PRD Reference:** §6.2 (Tab Project)
**Depends on:** Tab Info (shell tab dari Ray)

### Deskripsi
Tab kedua di Detail Client. Menampilkan semua **Project** (layanan yang
diminta client) sebagai list card.

**Catatan istilah:** di tampilan/UI, ini disebut "Project" — tapi di
database tetap pakai tabel `cases` (gak diganti, biar gak nulis ulang
kode yang udah merged). Jadi kalau nulis kode: field/variable/query tetap
`cases`/`case_id`, tapi teks yang muncul ke user (label, tombol, judul
tab) pakai kata "Project".

### Acceptance Criteria
- [ ] Tab berlabel **"Project"** (bukan "Case & Progress")
- [ ] Tiap project: jenis layanan, status (badge: Baru=biru, Proses=kuning, Selesai=hijau, Batal=merah), PIC internal, RAB, tanggal dibuat
- [ ] Tombol "+ Tambah Project" mengarah ke form Tambah Project (Issue #7, sudah ada — labelnya juga sudah diganti jadi "Project")
- [ ] Klik status badge → dropdown ubah status, tersimpan ke `UPDATE cases SET status = ...`
- [ ] Perubahan status otomatis membuat 1 baris baru di `activities`
- [ ] Klik nama PIC → dropdown reassign, HANYA aktif kalau role user = `admin`

### Catatan Teknis
Role check pakai `getProfile()` dari `src/lib/auth.js`. Daftar internal user: `SELECT id, name FROM profiles WHERE role IN ('admin','internal')`.
EOF
gh issue edit 6 --repo "$REPO" \
  --title "Tab Project — card project, ubah status, reassign PIC" \
  --body-file /tmp/i6.md

# ---------- Issue 8 ----------
cat > /tmp/i8.md << 'EOF'
**PRD Reference:** §6.2 (Tab Dokumen)
**Depends on:** Tab Info (shell tab dari Ray)

### Deskripsi
Tab ketiga di Detail Client. Menampilkan checklist dokumen, dikelompokkan
per **Project**.

### Acceptance Criteria
- [ ] Dokumen dikelompokkan per project (header nama project, list dokumen di bawahnya)
- [ ] Tiap dokumen: nama, status (badge: Belum=abu, Upload=biru, Terverifikasi=hijau, Ditolak=merah), link file, tombol ubah status
- [ ] Tombol "+ Tambah Dokumen" per project
- [ ] Ubah status dokumen otomatis membuat 1 baris baru di `activities`

### Catatan Teknis
`file_url` diisi manual (paste link) — tidak ada upload file langsung ke storage di iterasi ini. Field database tetap `case_id` (nama tabel `cases` tidak diganti), meski di teks/label yang tampil ke user disebut "project".
EOF
gh issue edit 8 --repo "$REPO" \
  --title "Tab Dokumen — checklist per project" \
  --body-file /tmp/i8.md

# ---------- Issue 9 ----------
cat > /tmp/i9.md << 'EOF'
**PRD Reference:** §6.2 (Tab Pembayaran)
**Depends on:** Tab Info (shell tab dari Ray)

### Deskripsi
Tab keempat di Detail Client. Menampilkan riwayat & rencana pembayaran,
dikelompokkan per **Project**.

### Acceptance Criteria
- [ ] Ringkasan: Total RAB vs Total sudah dibayar vs Sisa piutang
- [ ] Tiap project: list pembayaran (jenis, jumlah, status, tanggal dibayar)
- [ ] Tombol "+ Tambah Termin"
- [ ] Tombol "Tandai Lunas" — set status Lunas + paid_at = now()
- [ ] Tandai Lunas otomatis membuat 1 baris baru di `activities`
- [ ] Jumlah pembayaran harus angka positif

### Catatan Teknis
Format Rupiah pakai `Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR'})` — reuse dari `dashboard.js`. Field database tetap `case_id` (nama tabel `cases` tidak diganti).
EOF
gh issue edit 9 --repo "$REPO" \
  --title "Tab Pembayaran — termin, tandai lunas (per project)" \
  --body-file /tmp/i9.md

echo ""
echo "Selesai! Cek: gh issue list --repo $REPO"
