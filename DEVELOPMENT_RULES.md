
# Development-Rules

**Document Version:** v2.4.1
**Project:** SMA-app
**Guardian:** Mike (AI governance assistant)
**Bahasa:** Indonesia
**Terakhir diupdate:** 2026-09-02

**Purpose:** Master rules untuk membangun, melanjutkan, memodifikasi, dan memelihara **SMA-app** — internal CMS (Client Management System) milik Soul Mitra Abadi, perusahaan jasa konsultan perizinan usaha/legal.

**Description:** SMA-app adalah aplikasi internal yang dipakai tim Soul Mitra Abadi untuk mengelola client, case/project perizinan, dokumen, pembayaran, dan aktivitas terkait. Frontend memakai fork dari template Gentelella v4 (vanilla JS + Vite), backend memakai Supabase (Postgres + Auth + Row Level Security). Ini bukan demo template dan bukan produk yang dipublikasikan sebagai package.

---

# Chapter 0 — Cara Membaca Dokumen Ini

## C0P1 — Level Kewajiban

- **WAJIB** = harus diikuti, tidak ada pengecualian tanpa persetujuan eksplisit Ray.
- **KONDISIONAL** = berlaku tergantung situasi yang didefinisikan eksplisit di poin tersebut — bukan "sesuai kebijaksanaan".
- **BUTUH PERSETUJUAN RAY** = tindakan tidak boleh dilakukan sebelum Ray menyetujui secara eksplisit.
- **BUTUH REVIEW MIKE** = perubahan bersifat governance/permanen, wajib lewat proses review Mike sebelum diterapkan ke dokumen ini.

## C0P2 — Sistem Referensi

Setiap poin diberi kode `C{nomor-chapter}P{nomor-point}` (contoh: `C3P4`) supaya bisa disitir secara presisi di changelog atau diskusi, tanpa ambigu poin mana yang dimaksud.

## C0P3 — Prinsip AI Onboarding

Dokumen ini ditulis supaya bisa dipahami oleh AI atau developer baru **tanpa histori chat sebelumnya**. Kalau ada bagian yang ambigu, itu adalah bug dokumentasi — laporkan ke Ray atau Mike, jangan diasumsikan sendiri.

---

# Chapter 1 — Ringkasan Project

## C1P1 — Apa Itu SMA-app

SMA-app adalah **internal CMS** untuk Soul Mitra Abadi. Bukan demo/template Gentelella — repo ini fork dari template Gentelella v4 yang dipakai sebagai fondasi UI, lalu dikembangkan jadi aplikasi bisnis nyata.

## C1P2 — Stack

- **Frontend**: Gentelella v4 shell — vanilla JavaScript (ES2022), SCSS, Vite 8. Tidak ada framework SPA, tidak ada jQuery, tidak ada Bootstrap.
- **Backend**: Supabase (Postgres + Auth + Row Level Security). Tidak ada API server terpisah.
- **Auth & Role**: Invite-only. Empat role: `admin`, `supervisor`, `internal`, `client`. Detail mekanisme login per jenis user ada di C5P1.
- **Domain**: Dua domain terpisah — sisi admin di `team.soulmitra.id`, client portal di `mitra.soulmitra.id`. Aktivasi domain client portal di production sengaja ditunda sampai Ray memutuskan siap.

## C1P3 — Spesifikasi Produk

Spesifikasi fitur ("apa yang dibangun") hidup di file `PRD_*.md` / `PRD_*.pdf` di root repo. Dokumen ini **tidak** menjelaskan fitur — hanya menjelaskan cara kerja tim dan aturan teknis permanen.

---

# Chapter 2 — Governance & Struktur Otoritas

## C2P1 — Development-Rules Governance

`DEVELOPMENT_RULES.md` adalah **canonical technical source of truth project-wide** untuk workflow, governance, keputusan arsitektur permanen, coding convention lintas-fitur, AI collaboration, dan maintenance — setelah perubahan terkait di-merge ke `main`.

Versi dokumen ini di task branch boleh lebih baru daripada versi di `main`, tetapi statusnya adalah **branch-local newer version** dan belum menjadi canonical source of truth project-wide sampai merged ke `main`.

Mike berperan sebagai Guardian of The Document dan reviewer yang menjaga integrity, authenticity, structure, consistency, dan correctness dokumen. Untuk development flow, AI dan developer wajib menggunakan file tracked di repository sebagai referensi teknis utama sesuai scope branch aktif.

Keputusan final baru harus ditambahkan sebagai poin baru. Jika rule baru secara eksplisit menggantikan rule lama, rule terbaru yang sudah canonical menjadi source of truth.

## C2P2 — Struktur Otoritas & Kepemilikan Keputusan

| Peran | Nama | Wewenang |
|---|---|---|
| **Repo Owner / Final Decision Maker** | Ray (`soulmediaglobal`) — system architect | Pemegang keputusan akhir untuk product direction, scope, architecture-impacting decision, security/database decision material, governance approval, dan merge ke `main`. Bisa merge PR sendiri dan menggunakan escape hatch sesuai C3P6. |
| **COO / Orchestrator** | Rex | Communication dan orchestration hub project. Menentukan sequencing, dependency, blocker, ownership routing, dan next logical step. Rex tidak menjadi default coding executor atau governance authority. |
| **Product Manager** | Naya | Menentukan WHAT / WHY / FOR WHOM / PRIORITY / SCOPE, termasuk requirement, PRD, MVP boundary, acceptance criteria, dependency, dan success criteria. Tidak menentukan HOW implementation di luar product constraint yang diperlukan. |
| **Kontributor** | Dimas (`dancowwkk`) | PR wajib mendapat approval Ray sebelum merge. Tidak bisa self-approve. |
| **Guardian of The Document** | Mike | Menjaga, mereview, dan menstrukturkan canonical governance/documentation. Tidak menentukan product priority dan tidak menjadi default technical inspection/development executor. |

**Model kerja**: Ray dan Dimas umumnya mengerjakan sisi yang berbeda secara paralel — Ray berfokus ke sisi admin (`team.soulmitra.id`), Dimas ke sisi client portal (`mitra.soulmitra.id`) — masing-masing dengan AI assistant pilihannya sendiri. Keduanya bisa saja mengerjakan area yang tumpang tindih tergantung kebutuhan sprint; larangan edit file milik issue in-progress orang lain (C3P7) tetap berlaku terlepas dari domain mana yang biasanya dikerjakan siapa.

**WAJIB**: Perubahan pada tabel otoritas di atas adalah governance change → butuh review Mike (Chapter 9).

## C2P3 — Mike, Guardian of The Document

Mike adalah nama dan role untuk AI assistant dalam dedicated document-governance context sebagai **Guardian of The Document**. Mike bertanggung jawab membuat, memelihara, mengorganisasi, meninjau, dan melindungi integrity, authenticity, consistency, dan correctness The Document.

Mike fokus pada governance interpretation, canonical documentation integrity, source-of-truth discipline, permanent architecture documentation, versioning governance, dan lifecycle dokumentasi. Repository inspection teknis yang repetitif atau multi-file tidak perlu dilakukan oleh Mike bila dapat didelegasikan ke Codex/Work (lihat C6P8).

AI lain dan developer dapat mengeskalasikan collaboration mechanism baru, rule changes, atau document updates kepada Mike untuk ditinjau sebelum menjadi bagian dari The Document. Default cross-role routing berjalan melalui Rex sebagai communication hub.

Mike bukan nama generik untuk setiap AI. Mike secara khusus merujuk kepada Guardian of The Document untuk project SMA-app.

---

# Chapter 3 — Git & Collaboration Workflow

## C3P1 — Larangan Commit Langsung

**WAJIB** — Tidak boleh commit atau push langsung ke branch `main`. Semua perubahan lewat branch yang terhubung ke satu GitHub Issue.

## C3P2 — Satu Issue, Satu Branch

**WAJIB** — Branch dibuat lewat tombol "Development → Create a branch" di GitHub Issue terkait (bukan manual), supaya keterkaitan issue↔branch otomatis tercatat.

## C3P3 — Branch dari Main yang Fresh

**WAJIB** — Sebelum mulai kerja: `git checkout main && git pull` dulu, baru checkout/create branch dari `main` yang fresh. Tidak boleh branch dari `main` lokal yang basi.

## C3P4 — Pull Request Wajib

**WAJIB** — Setelah issue selesai, buka Pull Request ke `main`. Tidak boleh self-merge.

## C3P5 — Cross-Review

- Dimas → PR-nya direview Ray. **Tidak boleh self-approve.**
- Ray → PR-nya (kalau ada) direview Dimas, tapi Ray **boleh** merge sendiri sebagai repo owner.
- `main` branch-protected, wajib 1 approval sebelum merge — mengikat untuk Dimas.

## C3P6 — Escape Hatch Ray

**KONDISIONAL** — Ray boleh bypass review ("Merge without waiting for requirements to be met") **hanya** saat Dimas genuinely tidak available (traveling/offline) **dan** ada urgensi nyata. Bukan default. AI **tidak boleh** menyarankan atau menormalisasi bypass ini demi kenyamanan semata. Kalau Ray yang minta, itu keputusan Ray — AI tidak menolak, tapi juga tidak menawarkan duluan.

## C3P7 — Larangan Edit File Milik Orang Lain

**WAJIB** — Tidak boleh mengedit file yang sedang jadi scope issue in-progress milik orang lain, kecuali sudah dikoordinasikan eksplisit di komentar issue.

## C3P8 — AI Merge Boundary

**WAJIB** — AI (Claude Code, ChatGPT, atau AI assistant lain yang bekerja di repo ini) boleh menyiapkan branch, commit, dan pull request sampai ke status **merge-ready**. AI **tidak pernah** melakukan merge task branch ke `main` — merge manual adalah wewenang eksklusif Ray.

**WAJIB** — AI hanya boleh melakukan aksi yang **secara eksplisit diminta**. Kalau instruksi hanya "commit", AI berhenti setelah commit — tidak lanjut push, tidak lanjut buat PR, tanpa diminta eksplisit untuk masing-masing langkah tersebut. Melebarkan scope aksi (commit → push → PR) atas inisiatif sendiri **dilarang**, meskipun hasilnya nanti terbukti benar/aman setelah diverifikasi ulang — inisiatif macam ini tetap dianggap pelanggaran boundary, bukan dinilai dari hasil akhirnya.

Sebelum melaporkan sesuatu sebagai "merge-ready", AI wajib memverifikasi:
- Working tree bersih (tidak ada perubahan uncommitted).
- Branch lokal dan remote sinkron.
- Testing/verification (kalau ada) sudah dijalankan dan lulus.
- Dokumentasi dan changelog terkait sudah diupdate.
- Tidak ada known conflict atau blocker.

Setelah Ray menyetujui dan melakukan merge sendiri, AI melaporkan hasil merge (branch, commit hash, status).

## C3P9 — Definition of Done

**WAJIB** — Sebuah issue/task tidak dianggap selesai sampai seluruh checklist berikut terpenuhi, terlepas dari klaim siapapun (termasuk AI) bahwa pekerjaan "sudah selesai":

- [ ] Kode sudah lint + build pass.
- [ ] Diff sudah direview manual (`git diff`/`git show`) — bukan cukup percaya ringkasan perubahan dari AI yang mengerjakan.
- [ ] Testing/verifikasi manual sudah dilakukan dan buktinya dicatat (screenshot, hasil query, atau langkah reproduksi) di PR/issue.
- [ ] `App_Changelog.md` sudah diupdate untuk perubahan yang relevan (lihat C7P2).
- [ ] Tidak ada file di luar scope issue yang tersentuh.
- [ ] Kalau task menyentuh database: sudah diverifikasi langsung ke DB sesuai C5P5, bukan cuma migration file-nya ada.

Checklist ini berlaku sebagai syarat minimum sebelum PR dinyatakan merge-ready (lihat C3P8).

---

# Chapter 4 — Task / Issue Ownership Policy

## C4P1 — Ownership Tidak Dihardcode

**WAJIB**: Assignment task/issue **tidak dicatat permanen** di dalam The Document ini. Source of truth untuk siapa mengerjakan apa = **GitHub Issues** (assignee field + komentar).

## C4P2 — Alasan

Pembagian tugas antara Ray dan Dimas bersifat **rotatif** dan bisa berubah antar-sprint. Kalau ownership map ditulis di sini, dokumen ini akan cepat basi dan butuh update setiap kali ada rotasi — melanggar prinsip *low operational overhead*.

## C4P3 — Kewajiban Cek Assignee

**WAJIB** — Sebelum mulai mengerjakan sesuatu, AI/developer selalu cek assignee di GitHub Issue yang relevan, jangan asumsikan dari histori chat atau dokumen ini.

---

# Chapter 5 — Technical Architecture Rules (Permanen)

Bagian ini berisi aturan teknis yang berlaku jangka panjang — bukan tutorial/how-to (tutorial ada di Chapter 10, lihat C7P2).

## C5P1 — Auth & Akses

Empat role: `admin`, `supervisor`, `internal`, `client`. Role checks di UI adalah **UX convenience**, bukan security boundary — RLS (C5P2) adalah boundary yang sebenarnya.

Mekanisme login **berbeda** antara staff dan client:
- **Staff** (`admin`, `supervisor`, `internal`): OTP-only lewat email, invite-only. Tidak ada self-registration.
- **Client**: Google OAuth atau Email + Password. Alur pertama kali login mengarahkan ke pembuatan password awal sebelum masuk ke client portal.

**Gap keamanan yang diketahui (belum diputuskan)**: jalur Google OAuth untuk client saat ini tidak melakukan pengecekan invite-only — akun baru bisa terbuat lewat login Google tanpa proses invite, menghasilkan profile dengan `client_id` kosong (tidak terhubung ke data client manapun). Status ini dicatat di `KNOWN_GAPS.md`, belum ada keputusan resmi apakah ini disengaja atau perlu dibatasi.

## C5P2 — Row Level Security

**Row Level Security (RLS) adalah security boundary yang sebenarnya.** RLS aktif di semua tabel. Frontend hanya memakai anon key — tidak ada kode yang boleh mengasumsikan service-role key tersedia atau mencoba bypass RLS.

## C5P3 — Activity Logging

Setiap perubahan status (case, dokumen, pembayaran) **wajib** menghasilkan insert ke tabel `activities` yang mendeskripsikan perubahan tersebut. Setiap fitur yang mengubah status bertanggung jawab menulis activity-log-nya sendiri.

## C5P4 — Format Lokal

`Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR'})` untuk Rupiah, `Intl.DateTimeFormat('id-ID', ...)` untuk tanggal.

## C5P5 — Migration

Migration ditulis sebagai file `.sql` polos, dijalankan via `psql` terhadap connection string Supabase (Supabase Web SQL Editor terbukti tidak konsisten soal permission di project ini — hindari). Migration file yang sudah diterapkan **wajib** dicommit ke repo.

**WAJIB** — Migration file yang tercatat/merged di git **tidak boleh diasumsikan** sudah dijalankan ke database production. Sebelum mengandalkan skema atau data yang seharusnya dihasilkan sebuah migration, verifikasi langsung ke database (`psql`, cek keberadaan tabel/kolom/trigger sungguhan) — bukan cukup dengan melihat file migration ada di repo atau PR-nya sudah merged.

## C5P6 — Frontend Conventions (ringkas)

Vanilla DOM only, tidak ada jQuery/framework SPA tambahan. CSS custom properties untuk warna — tidak ada hex literal hardcoded di komponen. Lazy-import module per halaman dengan DOM-presence guard. Detail lengkap ada di Chapter 10 (C10P4 — Conventions).

## C5P7 — Test File Security

File test **wajib** tidak berisi URL hardcoded atau data sensitif (credential, token, API key, connection string produksi). Gunakan environment variable atau fixture/mock data untuk kebutuhan ini.

---

# Chapter 6 — AI / Developer Collaboration Rules

## C6P1 — Reference Model

Struktur file instruksi AI di project ini mengikuti reference model:

```text
DEVELOPMENT_RULES.md          ← canonical tunggal — governance (Chapter 0-9) + technical reference (Chapter 10)
CLAUDE.md                     ← stub, mengarah ke DEVELOPMENT_RULES.md
.cursor/rules/project.mdc     ← stub, mengarah ke DEVELOPMENT_RULES.md Chapter 10
.github/copilot-instructions.md ← stub, mengarah ke DEVELOPMENT_RULES.md Chapter 10
```

**Status implementasi**: `AGENTS.md` sudah tidak ada — isinya sudah dipangkas dan digabung jadi Chapter 10 di dokumen ini (lihat `Doc_Changelog.md` untuk detail perubahan). Isi stub `CLAUDE.md`, `.cursor/rules/project.mdc`, dan `.github/copilot-instructions.md` sudah diupdate secara fisik di repo (Tahap C, commit `68859ca`) — ketiganya sekarang mengarah ke `DEVELOPMENT_RULES.md`, tidak lagi ke `AGENTS.md` yang lama. Tahap B-D sudah selesai penuh dan tersinkron ke `origin/main`.

## C6P2 — Kewajiban AI Sebelum Mulai Kerja

1. Baca `DEVELOPMENT_RULES.md` (dokumen ini) Chapter 0-9 secara penuh, plus C10P1 (index Chapter 10) — lihat C6P6 soal cara baca Chapter 10.
2. Baca PRD yang relevan dengan issue yang dikerjakan.
3. Konfirmasi nomor GitHub Issue dan assignee-nya (C4P3).
4. Konfirmasi berada di branch fresh dari `main`, bukan `main` itu sendiri.
5. Kalau menemukan struktur file yang belum sesuai ekspektasi, **berhenti dan laporkan ke manusia**, jangan restrukturisasi sendiri.

## C6P3 — Guardian Boundary

Mike adalah satu-satunya AI yang berperan sebagai Guardian of The Document. AI/developer lain **boleh**: membaca, mengikuti, dan mengusulkan perbaikan ke dokumen ini. Perubahan governance permanen **wajib** direview lewat Mike (Chapter 9).

## C6P4 — Verification Protocol

**WAJIB** — Klaim bahwa sesuatu "sudah terjadi/selesai" tidak boleh dipercaya begitu saja, termasuk klaim dari AI yang sama di sesi yang sama. Setiap jenis klaim berikut wajib diverifikasi dengan cara yang bersesuaian sebelum ditindaklanjuti atau dilaporkan ke Ray/Dimas:

| Jenis klaim | Cara verifikasi wajib |
|---|---|
| "Migration sudah jalan" | Query langsung ke database (`psql`) — cek tabel/kolom/trigger sungguhan ada, bukan cuma file migration ada di git (lihat C5P5). |
| "Branch/PR sudah dibuat atau di-push" | `git log`, `git status`, `gh pr view` — bukan percaya laporan AI begitu saja. |
| "Fitur sudah selesai/berfungsi" | Testing manual (browser/UI atau API call langsung), buktinya dicatat (lihat C3P9). |
| "Config/environment variable sudah di-set di production" | Cek langsung ke sumbernya (`supabase secrets list`, dashboard terkait) — bukan asumsi dari histori chat atau dokumentasi lama. |

Prinsip ini berlaku dua arah: AI wajib memverifikasi klaim dari AI lain, dan juga wajib memverifikasi ulang klaimnya sendiri sebelum melaporkan sesuatu sebagai selesai.

## C6P5 — Repository Sync Check

**WAJIB** — Di awal setiap sesi kerja baru, sebelum mengambil keputusan apapun berdasarkan instruksi, briefing, atau ringkasan dari sesi sebelumnya, kondisi repository/GitHub aktual harus diverifikasi. Technical inspection ini default diarahkan ke Codex/Work sesuai C6P8; Ray tidak digunakan sebagai manual transport layer untuk inspection yang dapat dilakukan agent teknis secara langsung.

Verification minimal mencakup:
- current branch dan hubungannya dengan Issue yang relevan;
- sync/base state terhadap `origin/main`;
- GitHub Issue yang relevan, status, dan assignee;
- recent repository history yang material terhadap task;
- working tree state sebelum implementation.

**WAJIB** — Inspection bersifat evidence-gathering. Jangan mengubah branch, working tree, database, atau environment hanya untuk memperoleh informasi yang dapat diverifikasi secara read-only. Jika perubahan state memang dibutuhkan untuk melanjutkan task, perlakukan sebagai action terpisah sesuai Git/action boundary yang berlaku.

Instruksi atau framing dari sesi/percakapan sebelumnya (termasuk soal siapa mengerjakan issue apa, atau tahap project sudah sampai mana) **tidak boleh dipakai sebagai dasar kerja** sebelum dicocokkan dengan kondisi repo/GitHub aktual. Kalau ada ketidaksesuaian antara instruksi lama dan kondisi repo aktual, kondisi repo aktual yang menang — laporkan ketidaksesuaian tersebut, jangan diam-diam mengikuti salah satunya.

## C6P6 — AI Onboarding SOP & Escalation Criteria

**WAJIB** — Project ini dikerjakan oleh lebih dari satu AI assistant (berbeda-beda tergantung siapa yang memakai). Setiap AI yang mulai bekerja di repo ini wajib mengikuti urutan berikut, bukan cuma sekali baca lalu bebas berimprovisasi:

1. Baca `DEVELOPMENT_RULES.md` (dokumen ini) secara penuh — lihat juga C6P2.
2. Jalankan Repository Sync Check (C6P5).
3. Untuk technical/repository inspection, gunakan Codex/Work sebagai default execution layer bila tersedia. Untuk action yang memang harus dijalankan Ray secara manual, tetap gunakan satu perubahan/command per langkah, terutama untuk apapun yang menyentuh database atau environment production — beri jeda untuk verifikasi (C6P4) sebelum lanjut ke langkah berikutnya.
4. Kalau keputusan menyentuh struktur data, level akses, atau perubahan scope yang signifikan di luar apa yang diminta eksplisit — berhenti dan konfirmasi ke Ray dulu, jangan diasumsikan atau dieksekusi sepihak.
5. Kalau root cause sebuah masalah tidak kunjung jelas setelah perbaikan pertama tampak berhasil, tetap ditelusuri tuntas — jangan berhenti di perbaikan pertama yang kelihatannya berhasil tanpa verifikasi ulang.

**Escalation criteria** — kalau sebuah AI assistant berulang kali gagal mengikuti C3P8, C3P9, C6P4, atau C6P5 setelah diingatkan/dikoreksi secara eksplisit, penggunaannya untuk task tersebut dihentikan dan pekerjaan dialihkan ke AI lain atau dikerjakan manual. Ini bukan keputusan situasional per momen — begitu pola kegagalan berulang teridentifikasi dan sudah diperingatkan, penghentian adalah langkah standar, bukan opsional.

## C6P7 — Tiered Reading Rule

**WAJIB** — Dokumen ini punya dua tingkat kewajiban baca, supaya ukuran dokumen yang bertambah (karena Chapter 10) tidak otomatis menambah token cost per sesi, tanpa mengorbankan konteks yang dibutuhkan AI untuk kerja aman.

- **Tier 1 — Full-read wajib, tiap sesi, tanpa pengecualian**: Chapter 0 sampai 9, plus **C10P1** (index Chapter 10). Bagian ini berisi governance, workflow, dan collaboration rules yang bersifat safety-critical — melewatkan bagian manapun di sini berisiko melanggar boundary penting (contoh: melewatkan C3P8 bisa berujung AI melebarkan aksi commit/push tanpa diminta).
- **Tier 2 — Baca sesuai kebutuhan task, dituntun oleh C10P1**: C10P2 sampai C10P9 (detail Architecture, Conventions, Recipes, dst). AI **tidak boleh menebak sendiri** bagian mana yang relevan tanpa melihat index C10P1 dulu — index itu yang jadi peta keputusan, bukan asumsi bebas. Kalau task ternyata menyentuh area yang tidak disangka di awal (misal task soal chart ternyata butuh ubah shared component juga), AI kembali ke C10P1, cari poin yang relevan, baru buka detailnya — bukan melanjutkan tanpa referensi.

**Definisi "sesuai kebutuhan" yang tidak ambigu**: sebuah poin C10Px dianggap "dibutuhkan" untuk task tertentu kalau task tersebut akan mengubah, menyentuh, atau bergantung pada hal yang dideskripsikan di baris index poin tersebut (lihat tabel C10P1). Ini bukan penilaian subjektif AI — cukup dicocokkan dengan deskripsi satu baris di index. Kalau tidak yakin sebuah poin relevan atau tidak, default-nya **dibaca** (lebih aman melebihkan daripada melewatkan).

## C6P8 — Codex/Work-first Technical Inspection & Communication Routing

**WAJIB** — Technical/repository inspection yang dapat dilakukan langsung oleh agent teknis default diarahkan ke **Codex/Work**, bukan menggunakan Ray atau governance role sebagai manual transport layer.

Codex/Work digunakan untuk:
- repository inventory dan multi-file reading;
- implementation/dependency tracing;
- comparison implementation existing terhadap PRD/spec;
- Git history, Issue/PR, migration, diff, lint/build, dan static verification evidence;
- technical evidence gathering lain yang aman dilakukan langsung oleh agent teknis.

Boundary role:
- **Codex/Work** → inspect / implement secara teknis sesuai Issue, scope, governance, dan existing architecture.
- **Rex** → communication/orchestration hub; reconcile context, dependency, blocker, ownership, dan routing antar-role.
- **Mike** → review governance/documentation impact dan melindungi canonical permanent truth.
- **Naya** → product scope/requirement/priority.
- **Ray** → final authority untuk material product, scope, architecture, security/database, governance, dan merge decision.

Default communication path:
`Codex/Work → Rex → Mike/Naya/Ray bila domain terkait membutuhkan review/decision`.

Mike tidak digunakan untuk pekerjaan technical inspection yang dapat dilakukan lebih efektif oleh Codex/Work. Ray hanya dilibatkan jika dibutuhkan owner judgement atau action yang memang membutuhkan authority/manual execution Ray.

Codex/Work tidak menjadi governance authority dan tidak boleh mengubah permanent governance, product scope, atau merge ke `main` atas inisiatif sendiri.

## C6P9 — Manual vs Automate Opportunity Check

**WAJIB** — Sebelum menjalankan pekerjaan yang secara wajar diperkirakan memiliki repetition atau coordination cost yang material, role yang menerima task harus menilai apakah pekerjaan lebih efisien dijalankan sebagai eksekusi satu kali atau sebagai workflow automated/delegated.

Automation opportunity dianggap ada jika task memiliki satu atau lebih karakteristik berikut:

- inspection atau evidence gathering yang sama perlu dilakukan berulang;
- status Issue, PR, CI, migration, deployment, atau dependency perlu diperiksa secara periodik atau sampai kondisi tertentu terpenuhi;
- verification, audit, atau reporting memiliki pola berulang;
- pekerjaan memerlukan copy-paste atau handoff antar-role yang berulang;
- pekerjaan teknis yang sama kemungkinan besar akan muncul kembali dengan pola serupa;
- expected repetition atau coordination cost lebih besar daripada biaya menyiapkan workflow automated/delegated.

Jika automation opportunity terdeteksi, sebelum execution tawarkan kepada Ray:

> Task ini berpotensi cukup repetitif atau membutuhkan pengecekan berulang. Mau dijalankan:
>
> A. **MANUAL** — satu kali execution, tanpa recurring/conditional workflow; atau
>
> B. **AUTOMATE** — gunakan delegated, recurring, atau conditional workflow paling ringan yang sesuai?
>
> Jika salah satu opsi jelas lebih efisien, sertakan rekomendasi singkat beserta alasannya.

Pemilihan mode tidak mengubah execution routing:

- **MANUAL** berarti task dijalankan satu kali tanpa automation. Technical/repository inspection tetap default dilakukan langsung oleh Codex/Work sesuai C6P8; Ray tidak menjadi operator terminal, copy-paste, atau manual transport layer jika inspection dapat dilakukan agent teknis secara langsung.
- **AUTOMATE** berarti menggunakan delegated, recurring, atau conditional workflow paling ringan yang memenuhi kebutuhan. Jangan membangun automation yang lebih luas atau lebih kompleks daripada pola repetition yang telah disetujui.
- Untuk action yang memang wajib dilakukan Ray secara manual, disiplin satu action/perubahan atau satu command per langkah pada C6P6 tetap berlaku, disertai verifikasi sebelum langkah berikutnya.
- Untuk technical evidence gathering read-only yang dilakukan langsung oleh Codex/Work, multi-file inspection atau beberapa read-only checks yang aman dapat dilakukan sebagai satu delegated task; hal ini bukan pelanggaran terhadap manual one-command rule.

Automation tidak boleh:

- mengambil alih atau memperluas product scope;
- membuat keputusan governance atau permanent architecture;
- membuat material security/database decision;
- melakukan merge ke `main`;
- melakukan state-changing action yang belum diminta atau disetujui secara eksplisit;
- melewati verification, Issue ownership, Git/action boundary, atau approval yang diwajibkan rule lain.

Pilihan **AUTOMATE** hanya mengotorisasi workflow dan scope yang dijelaskan saat pilihan ditawarkan. Action tambahan seperti perubahan database/environment, commit, push, pembuatan PR, atau merge tetap mengikuti authority dan explicit-action boundary masing-masing.

Jangan menawarkan automation untuk pekerjaan one-off yang sederhana jika biaya setup atau coordination automation diperkirakan sama dengan atau lebih besar daripada menyelesaikan pekerjaan tersebut satu kali.

Core flow:

`DETECT REPETITION RISK → OFFER MANUAL VS AUTOMATE → RAY CHOOSES → EXECUTE`

---

# Chapter 7 — Documentation Structure

## C7P1 — Documentation Purpose

Setiap artefak development penting harus memiliki lokasi dokumentasi yang jelas di repository dan tidak boleh bergantung pada chat history sebagai satu-satunya sumber informasi.

## C7P2 — Canonical Documentation Locations

| Dokumen | Fungsi | Status source of truth |
|---|---|---|
| `DEVELOPMENT_RULES.md` (dokumen ini) | Governance (Chapter 0-9) + technical reference (Chapter 10) | **Canonical tunggal** — untuk governance maupun technical how-to |
| `CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md` | Stub per-tool, mengarah ke `DEVELOPMENT_RULES.md` | Bukan source of truth sendiri |
| `App_Changelog.md` | History development/fitur produk (rename dari `changelog.md`, commit `78263ac`, live di repo) | Canonical untuk riwayat fitur/rilis — jangan dicampur dengan governance changelog |
| `Doc_Changelog.md` | History perubahan governance (rename dari `NEW_CHANGELOG.md`) | Canonical untuk riwayat versi The Document |
| `PRD_*.md` / `PRD_*.pdf` | Spesifikasi produk per fitur | Canonical untuk "apa yang dibangun" |
| `CLIENT_SIDE_SYNC_SMA-app.md` | Handover Ray→Dimas soal domain/pembagian sisi admin vs client portal | Referensi konteks kerja, bukan governance — bukan pengganti C2P2 |
| `PROJECT_CONTEXT.md` | Snapshot/handover teknis (auto-generated) | **Bukan** source of truth — hanya referensi kondisi repo di satu titik waktu |
| `KNOWN_GAPS.md` | Daftar gap arsitektur/keputusan yang ditunda, belum diformalkan jadi Issue | Referensi sementara — item yang siap dikerjakan wajib dipindah jadi GitHub Issue |
| GitHub Issues | Assignment tugas, status kerja | Canonical untuk ownership task (Chapter 4) |
| ~~`AGENTS.md`~~ | Dihapus — isi sudah pindah ke Chapter 10. Status penghapusan fisik dari repo: lihat `Doc_Changelog.md`, mengikuti urutan B→C→D (C6P1). | — |
| ~~`CONTRIBUTING.md`, `docs/*.md` (16 file), `examples/`~~ | Dokumentasi generik template Gentelella, zero-value untuk SMA-app | Dihapus dari repo (Tahap D, commit `68859ca`) |

## C7P3 — File Naming Convention

Nama file dokumentasi harus: singkat, deskriptif, dan tidak menggunakan penanda seperti `final`, `latest`, `new`, atau `fix`. `Doc_Changelog.md` dan `App_Changelog.md` memakai PascalCase dengan underscore secara sengaja (bukan mengikuti gaya UPPERCASE seperti `DEVELOPMENT_RULES.md`) untuk membedakan pasangan keduanya secara visual sebagai satu keluarga nama, dan penamaan ini **case-sensitive** — tidak boleh ditulis dengan casing lain di kode, link, atau dokumentasi manapun.

## C7P4 — Documentation Sync Rule

Dokumentasi harus ikut diperbarui ketika task selesai atau state project berubah signifikan. Dokumen yang stale harus diperbaiki sebelum task dinyatakan selesai.

## C7P5 — Kategori Resmi `App_Changelog.md`

`App_Changelog.md` mengikuti format [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), dengan **5 kategori resmi** untuk project ini:

- **Added** — fitur/kapabilitas baru.
- **Changed** — perubahan behavior yang sudah ada.
- **Fixed** — perbaikan bug.
- **Removed** — fitur/kapabilitas yang dihapus.
- **Maintenance** — perubahan yang **tidak** menambah fitur, **tidak** mengubah behavior yang terlihat user, dan **tidak** memperbaiki bug. Contoh: dead code removal, penghapusan komentar usang, refactor tanpa perubahan output, cleanup dependency.

Kalau sebuah perubahan tidak jelas masuk kategori mana, tanyakan: *apakah user/behavior aplikasi berubah?* Kalau tidak sama sekali → `Maintenance`. Jangan membuat nama kategori baru (`Chore`, `Housekeeping`, `Cleanup`, dst) — pakai salah satu dari 5 di atas.

Precedent pertama kategori `Maintenance`: Issue #179 (cleanup dead CSS + komentar hilang, non-functional), dicatat di `App_Changelog.md` section `[Unreleased]`.

---

# Chapter 8 — Versioning

## C8P1 — Semantic Versioning

- **PATCH** — klarifikasi, koreksi, refinement kecil, non-breaking.
- **MINOR** — kapabilitas baru, penambahan Chapter besar.
- **MAJOR** — redesign governance yang breaking, perubahan filosofi source-of-truth, perubahan sistem identifikasi, redefinisi workflow fundamental.

## C8P2 — Single Version Track

Berbeda dari sebagian project lain yang memisahkan "Document Version" dari "Product/Web Version", SMA-app **hanya memakai satu version track** untuk `DEVELOPMENT_RULES.md` itu sendiri. Versi produk/aplikasi SMA-app (kalau diperlukan di masa depan) adalah keputusan governance terpisah dan belum diadopsi di sini.

---

# Chapter 9 — Governance Change Procedure

## C9P1 — Threshold Perubahan

Perubahan pada dokumen ini hanya dilakukan untuk hal yang memengaruhi cara project beroperasi ke depan — bukan untuk setiap saran atau optimasi situasional.

**Butuh review Mike:**
- Rule permanen baru, revisi rule existing
- Perubahan workflow git/collaboration
- Perubahan struktur/ownership dokumentasi
- Perubahan source-of-truth
- Pola kolaborasi AI/developer yang reusable

**Tidak butuh review Mike:**
- Coding normal, bug fix biasa
- Implementasi yang mengikuti rule yang sudah ada
- Build/test run normal
- Update `App_Changelog.md` (bukan governance changelog)
- Verifikasi Git standar

## C9P2 — Prosedur

Perubahan governance mengikuti: **Diskusi/Review Mike → Persetujuan Ray → Update Chapter terkait → Update `Doc_Changelog.md` → Commit → Push.**

---

# Chapter 10 — Technical Reference & Component Library

Chapter ini adalah hasil merge dari `AGENTS.md` (yang sudah dipangkas dari konten generik Gentelella yang tidak relevan untuk SMA-app — npm publish, CDN jsDelivr, dsb) plus beberapa poin yang diselamatkan dari `CONTRIBUTING.md` sebelum file itu dihapus.

**Cara baca Chapter ini berbeda dari Chapter 0-9** (lihat C6P2/C6P6 untuk aturan lengkapnya): C10P1 di bawah ini **wajib dibaca tiap sesi** (murah, cuma index). Detail di C10P2 dan seterusnya **dibaca sesuai kebutuhan task** — buka bagian yang relevan, tidak perlu baca semua dari atas ke bawah.

## C10P1 — Index (WAJIB dibaca tiap sesi)

| Poin | Topik | Kapan dibutuhkan |
|---|---|---|
| C10P2 | Architecture | Perlu paham bagaimana shell, entry point, dan lazy-loading bekerja |
| C10P3 | Directory Layout | Cari tahu file/folder mana untuk hal apa |
| C10P4 | Conventions | Aturan penulisan kode day-to-day (DOM, CSS variables, spacing, dll) |
| C10P5 | Anti-patterns | Cek sebelum melakukan sesuatu yang mungkin sudah dilarang |
| C10P6 | Recipes | Langkah konkret: tambah halaman, chart, modal/toast, komponen baru, cari info Supabase (session pooler/region), kredensial publik project |
| C10P7 | Subpath / Deploy | Build dan deploy dengan `BASE_PATH` |
| C10P8 | TypeScript / IntelliSense | Soal `types/gentelella.d.ts` |
| C10P9 | Commands Reference | Daftar lengkap `npm run ...` |

## C10P2 — Architecture

- **Single entry** `src/main-v4.js`. Impor `scss/v4/main.scss`, mount shell, jalankan `initCharts/initTables/initCommandPalette/initPageActions`, lalu lazy-import module spesifik halaman dengan DOM-presence guard (`if (document.getElementById('inbox-root')) import(...)`).
- **Shell injection saat build.** `vite.config.js` punya `shellInjectionPlugin` yang inline sidebar/topbar/footer ke setiap halaman dengan `data-shell="admin"` di body. Tidak ada FOUC. Runtime `src/v4/shell.js` `mountShell()` adalah fallback untuk buka HTML mentah.
- **Entry auto-discovered.** `discoverEntries()` di `vite.config.js` scan `production/*.html` dan register masing-masing sebagai Rollup input — tidak ada daftar input manual.
- **Tiga lazy vendor chunk**: `vendor-echarts` (halaman chart), `vendor-tables` (halaman tabel), `vendor-maps` (halaman map). Sisanya masuk main chunk.
- **NAV satu konstanta.** `NAV` di `src/v4/shell-render.js`, 7 grup. Halaman match ke NAV lewat `data-page` ↔ leaf `key`.
- **Theming lewat CSS custom properties.** Token di `src/scss/v4/_tokens.scss` di bawah `:root` dan `[data-theme="dark"]`. Pre-paint inline script (di Vite plugin) set `data-theme` di `<html>` dari `localStorage` sebelum body render.
- **PWA.** Service worker cuma register di `import.meta.env.PROD`. `site.webmanifest` + meta tags di-inject ke tiap halaman oleh Vite plugin. Subpath-safe: path pakai `import.meta.env.BASE_URL`.

## C10P3 — Directory Layout

```text
src/
  main-v4.js               # Entry — mounts shell, lazy-loads modules
  scss/v4/                 # 10 partials, main.scss adalah @use'd entry
  v4/
    shell.js               # mountShell — runtime shell behavior
    shell-render.js        # Pure renderers + NAV + ICONS
    menus.js                # openMenu / openPanel
    modal.js                # showModal
    toast.js                # showToast
    charts.js                # ECharts wrapper + factories
    tables.js                # DataTables wrapper
    command-palette.js       # Command palette (Cmd+K)
    page-actions.js
    inbox.js kanban.js calendar.js settings.js file-manager.js
    form-controls.js         # Date range, multi-select, rich text
    details.js markup.js data-adapter.js
production/                 # Halaman HTML entry (auto-discovered)
public/                     # Copied verbatim ke dist/
types/gentelella.d.ts       # Type declarations untuk public JS surface
scripts/
  new-page.mjs              # npm run new -- <slug>
  screenshots.mjs           # npm run screenshots
  smoke.mjs                 # npm run smoke
  deploy-preview.sh         # npm run deploy:preview
```

## C10P4 — Conventions

1. **Vanilla DOM only.** `querySelector`, `classList`, `addEventListener`. Tidak ada jQuery, tidak ada framework SPA.
2. **Lazy import module per-halaman** dengan DOM-presence guard, supaya main bundle tidak pernah ship kode yang tidak dipakai.
3. **`init<n>()` export idempotent.** Aman dipanggil ketika root element tidak ada; aman dipanggil dua kali.
4. **Event delegation di `document`** untuk interaksi umum (toggle, todo checkbox, chart tab) — lihat bagian bawah `src/main-v4.js`. Komponen yang punya state sendiri (inbox, kanban, command palette) register di root-nya sendiri.
5. **`showModal()` / `showToast()`** (`v4/modal.js`, `v4/toast.js`) untuk overlay; **`openMenu()` / `openPanel()`** (`v4/menus.js`) untuk dropdown dan slide-out. Keduanya handle outside-click / escape / focus return.
6. **CSS custom properties untuk warna.** Tidak ada hex literal di komponen. Chart baca lewat `getComputedStyle(document.documentElement).getPropertyValue('--…')` supaya redraw dark-mode otomatis.
7. **Subpath-safe URLs.** Pakai `import.meta.env.BASE_URL` di JS dan `${base}` di Vite plugin. Di dalam `production/*.html`, pakai relative path.
8. **Tidak ada `console.*` di kode yang di-ship.** Terser drop otomatis di production build; lint flag lebih awal.
9. **ESLint + Prettier** (single quotes, semicolons, 2-space indent). Jalankan sebelum commit.
10. **Shell opt-in.** Halaman tanpa `data-shell="admin"` tidak dapat sidebar/topbar (login, marketing, error pages).
11. **Spacing scale.** Semua padding/margin/gap pakai `var(--space-1)` … `var(--space-6)` (4 / 8 / 12 / 16 / 24 / 32px — skala sama dengan Tailwind spacing), didefinisikan di `_tokens.scss`. Keluar dari skala kadang benar (misal 14px antara dua label spesifik) tapi harus jadi pengecualian, bukan kebiasaan.
12. **Komentar menjelaskan *kenapa*, bukan mengulang *apa*.** Komentar yang cuma mendeskripsikan ulang baris kode di bawahnya tidak menambah nilai — hindari.

## C10P5 — Anti-patterns

- Jangan tambah jQuery, Bootstrap, atau framework SPA apapun.
- Jangan tulis daftar Vite entry input manual — cukup taruh file di `production/`.
- Jangan bikin modal/toast/dropdown sendiri — pakai `v4/modal.js`, `v4/toast.js`, `v4/menus.js`.
- Jangan hardcode `/` di asset path. Pakai `import.meta.env.BASE_URL`.
- Jangan bypass `mountShell()` untuk wiring sidebar/topbar manual — set `data-shell="admin"` dan biarkan Vite plugin inject.
- Jangan import semua ECharts. Pakai modular import — ikuti pola di `src/v4/charts.js`.
- Jangan edit file di `dist/`, `node_modules/` — generated.
- Jangan tambah build step selain Vite. Tidak ada PostCSS pipeline terpisah, tidak ada Webpack paralel, tidak ada Tailwind.
- Jangan pakai `new bootstrap.Modal(...)` — tidak ada Bootstrap di project ini.

## C10P6 — Recipes

### Tambah halaman baru
Cara cepat (scaffolder otomatis nulis HTML, body attribute, dan opsional entry NAV):
```bash
npm run new -- reports --title "Reports" --nav-group "Admin"
```
Cara manual:
1. `production/<slug>.html` dengan `<body data-shell="admin" data-page="<slug>" data-breadcrumb="Home > …">` dan `<script type="module" src="/src/main-v4.js"></script>` di `<head>`.
2. Tambahkan ke grup yang sesuai di `NAV` di `src/v4/shell-render.js`. `key` harus match `data-page`.
3. Icon baru? Tambahkan ke `ICONS` di file yang sama (inline SVG, `currentColor` stroke).

### Tambah chart
1. `<div class="card chart-card"><div class="chart" data-chart="<id>"></div></div>` di halaman.
2. Tambahkan `case '<id>':` di `initCharts()` di `src/v4/charts.js` yang build dan return ECharts `option`.
3. Baca warna lewat `getComputedStyle(document.documentElement).getPropertyValue('--token-name')` — dark mode redraw otomatis.

### Tambah modal atau toast
```js
import { showModal } from './v4/modal.js';
showModal({
  title: 'Delete project?',
  body: 'This cannot be undone.',
  actions: [
    { label: 'Cancel', variant: 'ghost' },
    { label: 'Delete', variant: 'danger', action: () => { /* … */ } }
  ]
});

import { showToast } from './v4/toast.js';
showToast('Saved', { variant: 'success' });
```

### Tambah komponen shared baru
Taruh SCSS di partial yang sesuai:

| Partial | Kapan dipakai |
|---|---|
| `_components.scss` | Reusable, dipakai di banyak halaman (button, card, table, status, toggle) |
| `_widgets.scss` | Widget gaya dashboard (stat tile, sparkline, donut, todo) |
| `_pages.scss` | Layout khusus satu halaman (invoice, calendar, pricing, landing) |
| `_apps.scss` | App surface yang lebih berat (chat, kanban, file manager, settings) |
| Partial sendiri | Override vendor library (mengikuti pola `_datatable.scss`) |

### Tambah module page-local
```js
// Di bagian bawah src/main-v4.js:
if (document.querySelector('.reports-root')) {
  import('./v4/reports.js').then((m) => m.initReports());
}
```
Export satu `initReports()` dari `src/v4/reports.js`. Guard re-entry; idempotent.

### Cari info Supabase (session pooler / region)

**Session pooler** (buat export DB via terminal, `pg_dump` dsb.):
```
postgresql://postgres.qnxmtjbiglnjqjyfmdfy:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```
Ganti `[YOUR-PASSWORD]` dengan DB password project (Supabase Dashboard → Project Settings → Database → Connection string). Jangan pernah commit password asli ke repo/dokumen manapun.

**Region:** `ap-northeast-1`

Cek ulang kalau perlu verifikasi: Supabase Dashboard → Project Settings → General → Region.

### Kredensial publik project (Supabase & deploy)

**Project URL:** `https://qnxmtjbiglnjqjyfmdfy.supabase.co`
**Publishable key:** `sb_publishable_xaF3BvDBSBMj5_bMj6WlaQ_voPnp9_J`
**Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFueG10amJpZ2xuanFqeWZtZGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjcwOTUsImV4cCI6MjEwMjY0MzA5NX0.mPAj_l04ZicNghjwNLRgXP8xblRBucO5pJ6zSblXogw`

Kedua key ini aman disimpan di dokumen — didesain publik/client-side, dilindungi RLS. **Jangan pernah** tambahkan `service_role key` di sini atau di file manapun yang masuk repo — itu bypass RLS sepenuhnya.

**Link Production (Cloudflare Pages/Workers):** `sma-app.soulmediaglobal-ind.workers.dev`

## C10P7 — Subpath / Deploy

```bash
BASE_PATH=/theme/gentelella/ npm run build      # build under a subpath
PREVIEW_SLUG=gentelella npm run deploy:preview  # build + R2 sync, scoped to /theme/gentelella/
```

`scripts/deploy-preview.sh` melakukan tiga pass: long-cache untuk hashed assets, short-cache untuk HTML, no-cache untuk `sw.js` dan `site.webmanifest`.

## C10P8 — TypeScript / IntelliSense

Tidak ada file `.ts`, tapi `types/gentelella.d.ts` mendeklarasikan public JS surface. `package.json` field `"types"` mengarah ke situ; VS Code/editor lain otomatis pickup untuk IntelliSense di seluruh `src/v4/*.js`.

## C10P9 — Commands Reference

```bash
npm run dev                # Dev server di :9173 (PORT untuk override)
npm run build               # Production build → dist/
npm run preview              # Serve dist/ di :9174
npm run lint                  # ESLint
npm run lint:fix
npm run format                # Prettier write
npm run format:check
npm run new -- <slug>          # Scaffold halaman baru
npm run screenshots             # Screenshot ke docs/screenshots/
npm run smoke                    # Boot dev server, fetch tiap halaman, assert 200
npm run analyze                   # Build + buka dist/stats.html
npm run deploy:preview              # Build + R2 sync
```
