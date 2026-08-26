-- Issue #122 — Catat schema kolom profile tambahan yang belum ada
-- migration + bersihkan data fiktif.
--
-- 5 kolom ini ditemukan sudah ada di production (avatar_url, bio,
-- position, company, social_links) tanpa migration file sama sekali
-- — kemungkinan besar dieksekusi via Supabase SQL Editor manual di
-- sesi lain, menyimpang dari konvensi project (psql + migration file
-- wajib). bio/position/company terisi data fiktif/karangan generik di
-- semua row (bukan data asli). Migration ini "mengesahkan" struktur
-- kolom ke git (idempotent, aman dijalankan di environment manapun)
-- dan membersihkan data fiktifnya.
--
-- preferences (kolom jsonb lain yang juga sudah ada tanpa migration)
-- SENGAJA TIDAK disentuh di sini — datanya variatif per user (beda
-- setting notifikasi antar orang), kemungkinan besar data asli dari
-- fitur Notifications di halaman profile lama, bukan data fiktif.

begin;

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists position varchar(100),
  add column if not exists company varchar(100),
  add column if not exists social_links jsonb default '{}'::jsonb;

-- Bersihkan data fiktif/karangan yang terisi di semua row.
update public.profiles
set bio = null,
    position = null,
    company = null
where bio is not null or position is not null or company is not null;

commit;
