-- Issue (belum dibuat saat file ini ditulis) — PROJECT, Part IV: Seed
-- Data Awal document_templates.
--
-- Bukan halaman kelola master dokumen (itu fitur terpisah, di luar
-- 7-part PROJECT — ditunda, tidak diprioritaskan sekarang). Ini cuma
-- ngisi daftar dokumen umum yang sering dipakai, supaya field
-- multi-select dokumen di form RAB/Penawaran (Part V) punya data buat
-- dipilih.
--
-- Daftar di bawah disusun dari observasi dokumen yang sudah pernah
-- muncul di data existing (documents.name) sepanjang sesi ini, plus
-- dokumen umum yang lazim di jasa perizinan/legal. BUKAN daftar final —
-- gampang ditambah lewat INSERT baru kapan saja, tidak butuh migration
-- terpisah untuk nambah 1 baris.

begin;

insert into public.document_templates (name, category, default_service_types, is_active) values
  ('KTP Direktur', 'Identitas', array['Pendirian PT','Pendirian CV','Pendirian Yayasan','Perubahan Pengurus'], true),
  ('KTP Pemilik', 'Identitas', array['NIB','SIUP','NPWP Perusahaan'], true),
  ('NPWP Perusahaan', 'Legalitas', array['NIB','SIUP','Izin Usaha','Laporan Tahunan'], true),
  ('NPWP Pribadi', 'Identitas', array['Pendirian PT','Pendirian CV'], true),
  ('NIB', 'Legalitas', array['PBG','SLF','Izin Usaha','Izin Operasional'], true),
  ('Akta Pendirian', 'Legalitas', array['Perubahan Pengurus','Akta Perubahan Modal','Laporan Tahunan'], true),
  ('Akta Perubahan', 'Legalitas', array['Perubahan Pengurus','Akta Perubahan Modal'], true),
  ('SK Kemenkumham', 'Legalitas', array['Pendirian PT','Perubahan Pengurus'], true),
  ('Surat Kuasa Pengurusan', 'Legalitas', null, true),
  ('Bukti Domisili Usaha', 'Legalitas', array['PBG','SLF','Izin Lingkungan (UKL-UPL)'], true),
  ('Dokumen Bangunan (Gambar/IMB Lama)', 'Teknis', array['PBG','SLF','IMB ke PBG'], true),
  ('Dokumen Pendukung Lingkungan', 'Teknis', array['Izin Lingkungan (UKL-UPL)','Amdal'], true),
  ('Sertifikat Tanah/Bukti Kepemilikan', 'Legalitas', array['PBG','SLF'], true),
  ('Laporan Keuangan', 'Keuangan', array['Laporan Tahunan','Sertifikasi Halal'], true),
  ('Surat Keterangan Domisili', 'Legalitas', array['NIB','SIUP'], true);

commit;
