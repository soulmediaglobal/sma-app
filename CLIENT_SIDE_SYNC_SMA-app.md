# Client-Side Sync — SMA-app

**Untuk:** Dimas + AI yang dia pakai (ChatGPT/Codex/apapun)
**Dari:** Ray (sisi admin)
**Terakhir diupdate:** 23 Agustus 2026
**Konteks:** Domain final — `soulmitra.id`. Admin di `team.soulmitra.id`,
client di `mitra.soulmitra.id`. Dokumen ini nyambungin apa yang udah
dibangun di sisi admin ke apa yang perlu dibangun di sisi client, biar
gak dobel kerja atau salah asumsi skema.

File referensi lengkap ada di repo (`soulmediaglobal/sma-app`):
- `PRD_Workflow_Layer_SMA-app.md` — desain `case_stages`,
  `document_versions`, perluasan `payments`
- `PRD_Project_Intake_RAB_Workflow_SMA-app.md` (v3.0) — desain alur
  Project → RAB → Penawaran → Terima/Tolak/Nego

---

## Bagian 1 — Untuk Dimas (baca ini dulu)

### Status sisi admin sekarang

Fitur besar **"PROJECT — Intake & RAB Workflow"** lagi dibangun
bertahap (7 part). Yang udah selesai:

- ✅ Schema RAB/penawaran (`case_quotations`, versioned, status
  DRAFT/SENT/ACCEPTED/REJECTED/NEGOTIATING/SUPERSEDED)
- ✅ Rincian termin (`case_quotation_items`)
- ✅ Master jenis dokumen (`document_templates`, 15 dokumen umum sudah
  di-seed)
- ✅ Multi-assign tim internal per project (`case_assignees`) — sudah
  ada UI-nya di admin
- ✅ Tab Workflow admin — nampilin progress `case_stages` per project

Yang **belum**: form/UI buat bikin RAB itu sendiri (Part V), dan alur
Terima/Tolak/Nego (Part VI) — jadi walaupun skema/RLS-nya udah siap
nerima aksi dari client, **belum ada RAB yang beneran bisa dikirim**
dari sisi admin ke client hari ini.

### Yang UDAH bisa lo kerjain sekarang (RLS sudah dibuka buat role `client`)

| Tabel | Akses client | Buat apa |
|---|---|---|
| `cases` | SELECT (miliknya sendiri) | Info project: nama layanan, status |
| `case_stages` | SELECT (miliknya sendiri) | **Progress Workflow** — timeline tahap, sama persis konsepnya kayak yang lo demo di prototype lo dulu (Diterima→Siap Dokumen→Verifikasi→dst), cuma sekarang datanya dari sini, bukan hardcode |
| `documents` | SELECT (miliknya sendiri) | Daftar slot dokumen yang dibutuhkan per project |
| `document_versions` | SELECT + **INSERT** (miliknya sendiri) | **Client BISA upload versi dokumen baru** — ini udah siap dipakai sekarang. Client cuma bisa nambah versi baru, gak bisa ubah/hapus versi lama (riwayat tetap kesimpen) |
| `payments` | SELECT (miliknya sendiri) | Lihat tagihan, status Pending/Lunas |
| `case_quotations` | SELECT (miliknya sendiri) | Lihat draft/riwayat penawaran — **tapi belum bisa Terima/Tolak/Nego** (write access belum dibuka, nunggu Part VI) |
| `case_quotation_items` | SELECT (miliknya sendiri) | Rincian termin di penawaran |

**Rekomendasi urutan kerja buat lo:** lanjutin dulu bagian yang datanya
udah bisa lo pakai sekarang — **dashboard project + progress Workflow +
upload dokumen** (3 tabel pertama di atas). Bagian **"Terima/Tolak/Nego
penawaran"** itu tunda dulu — walau UI-nya boleh lo cicil bikin, dia
gak akan bisa nembak database beneran sampai Part VI kelar (kita akan
kabarin begitu itu siap).

### Yang PERLU dikoordinasikan bareng (jangan jalan sendiri-sendiri)

- **RLS write buat `case_quotations`** (Terima/Tolak/Nego) — logic
  keamanan transisi statusnya belum dirancang detail. Kalau lo udah
  mulai mikirin UI buat ini, kabarin, biar kita samain sebelum RLS-nya
  dibuka — supaya lo gak harus rombak UI ulang kalau ternyata field/
  syaratnya beda dari yang lo bayangin.
- **Halaman "Penawaran Menunggu Persetujuan"** — kemungkinan overlap
  sama Issue #25 (Client Self-Service Portal) yang udah lo kerjain
  duluan. Kabarin progress lo di situ biar gak dobel struktur halaman.

---

## Bagian 2 — Untuk AI yang Dimas pakai

Kamu kerja di client-side SMA-app (`mitra.soulmitra.id`, masih dalam
pengembangan, domain final belum tentu sudah dikonfigurasi). Stack:
Gentelella v4 (vanilla JS ES2022 + Vite), Supabase (Postgres + Auth +
RLS), tanpa API server terpisah. Gunakan `@supabase/supabase-js`
langsung, RLS yang menjaga akses (anon key saja, jangan asumsikan
service-role).

### Skema yang relevan buat kamu (role `client`, sudah aktif di database)

```
cases              — project. Kolom relevan: id, service_type, status,
                     intake_status, current_stage_id, client_id
case_stages        — tahap workflow per project. Kolom: id, case_id,
                     name, order_index, status, owner, blocking_reason,
                     due_at, started_at, completed_at
documents          — slot dokumen yang dibutuhkan. Kolom: id, case_id,
                     name, status (Belum/Upload/Terverifikasi/Ditolak)
document_versions  — riwayat upload per slot dokumen. Kolom: id,
                     document_id, version_number, file_url, status,
                     rejection_reason, uploaded_by, created_at
payments           — tagihan. Kolom: id, case_id, amount, type, status
                     (Pending/Lunas), paid_at, invoice_number,
                     invoice_issued_at, receipt_number, receipt_issued_at
case_quotations    — RAB/penawaran header. Kolom: id, case_id, version,
                     status (DRAFT/SENT/ACCEPTED/REJECTED/NEGOTIATING/
                     SUPERSEDED), total_amount, notes, sent_at,
                     responded_at, client_response_notes
case_quotation_items — rincian termin. Kolom: id, quotation_id,
                     term_name, amount, due_condition, order_index
```

Semua RLS untuk role `client` sudah pakai pola SELECT-own via join ke
`cases.client_id`, contoh untuk `case_stages`:

```sql
using (
  auth_role() = 'client'
  and exists (
    select 1 from cases c
    where c.id = case_stages.case_id
      and c.client_id = auth_client_id()
  )
)
```

Query kamu otomatis kefilter cuma ke data project milik client yang
login — kamu gak perlu tambahin `WHERE client_id = ...` manual di
frontend, RLS udah handle itu di level database.

### ⚠️ Gotcha yang sudah kejadian di sisi admin — hindari ini

**Ambiguous FK embed.** Beberapa tabel (`cases`, `case_assignees`)
punya LEBIH DARI SATU foreign key ke `profiles`. Kalau kamu embed
`profiles` di select tanpa spesifik, Supabase/PostgREST bakal nolak
query-nya ("more than one relationship was found") — dan errornya bisa
diam-diam gagal tanpa keliatan jelas di UI kalau gak di-handle. Selalu
disambiguasi eksplisit:

```js
// SALAH — ambigu kalau tabelnya punya >1 FK ke profiles
.select('id, assignee:profiles(name)')

// BENAR — sebutkan nama kolom FK-nya
.select('id, assignee:profiles!assigned_to(name)')
```

### Yang BELUM bisa kamu pakai (write access belum dibuka)

- `case_quotations` / `case_quotation_items` — SELECT only untuk
  sekarang. **Jangan bangun tombol Terima/Tolak/Nego yang nembak
  database langsung** — RLS write-nya belum ada, request bakal ditolak
  RLS. UI-nya boleh dicicil, tapi hubungkan ke backend belakangan
  setelah dikonfirmasi dari sisi admin.
- `document_templates` — kamu gak perlu akses ke tabel ini langsung.
  Dokumen yang WAJIB diupload per project itu baca dari `documents`
  (yang udah jadi row per slot untuk case tertentu), bukan query ke
  master template.

### Cara verifikasi kerja kamu

Sebelum bilang selesai, jalankan build project (`npm run lint && npm
run build`), dan **coba buka beneran di browser** kalau memungkinkan —
jangan cuma percaya lint/build PASS. Ada kejadian nyata di sisi admin
minggu ini: bug ambiguous-FK di atas cuma ketahuan pas dites manual di
browser, lint & build-nya PASS mulus padahal fiturnya gagal total.
