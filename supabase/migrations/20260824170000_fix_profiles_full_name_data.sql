-- Issue #105 — Fix data profiles.full_name yang salah.
--
-- Backfill full_name (Issue #99, dieksekusi manual via Supabase SQL
-- Editor tanpa migration file — menyimpang dari konvensi psql Session
-- Pooler) mengisi nilai dari prefix email (user@domain.com -> "user"),
-- bukan dari kolom `name` yang sudah ada dan benar sejak awal.
--
-- Contoh sebelum fix:
--   name="Ray", full_name="soulmediaglobal.ind" (harusnya "Ray")
--   name="Dimas", full_name="pleasecallme.rayhan" (harusnya "Dimas")
--
-- Kolom full_name dan email TIDAK dihapus — dipertahankan untuk
-- rencana Issue #100 (halaman profil, user bisa edit nama tampilan
-- sendiri). Migration ini cuma mengoreksi data awal yang salah, dan
-- sekaligus mencatat resmi ke git skema yang sudah live di production
-- tapi sebelumnya tidak punya migration file (kolom full_name, email
-- dari Issue #99 dieksekusi tanpa migration).

begin;

-- Catatan: kolom full_name dan email sudah ada di production (dibuat
-- via SQL Editor manual, Issue #99). "add column if not exists" di
-- sini murni supaya migration file ini idempotent & bisa dijalankan
-- di environment lain (staging/fresh db) tanpa error kalau kolomnya
-- belum ada di sana.
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists email text;

-- Koreksi data: full_name disamakan dengan name (sumber yang benar).
update public.profiles
set full_name = name
where full_name is distinct from name;

commit;
