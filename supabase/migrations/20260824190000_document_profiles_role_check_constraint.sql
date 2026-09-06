-- Mendokumentasikan constraint profiles_role_check yang sudah ada di
-- production tapi belum pernah dibuatkan file migration.
--
-- Menutup celah: kolom profiles.role sebelumnya tidak divalidasi di
-- level DB, jadi typo atau bug bisa menulis role yang tidak dikenal
-- (silent auth_role() failure — user kehilangan akses tanpa error
-- yang jelas).
--
-- Catatan: constraint ini sudah ada di production (diverifikasi lewat
-- pg_constraint pada 2026-08-24), dibuat sebelum file ini ada. File
-- ini idempotent (aman dijalankan ulang) dan jadi acuan resmi untuk
-- environment lain.

begin;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'supervisor', 'internal', 'client'));

commit;
