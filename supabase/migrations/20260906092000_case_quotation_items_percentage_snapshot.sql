-- Issue #188: tambah kolom percentage_snapshot di case_quotation_items.
-- Dihitung SEKALI saat Termin disimpan (amount pre-tax / Subtotal
-- Pekerjaan * 100), lalu disimpan sebagai snapshot -- TIDAK auto-update
-- kalau RAB diedit ulang setelahnya. Field amount juga berubah makna
-- jadi nilai SEBELUM pajak (pajak dihitung on-the-fly per-termin saat
-- ditampilkan, tidak disimpan kolom baru -- konsisten dengan pola
-- computeTaxAmount/computeGrandTotal dari Issue #177). Data RAB lama
-- (belum production) di-reinterpretasi maknanya, tidak ada migration
-- data -- dikonfirmasi aman oleh Ray.
ALTER TABLE case_quotation_items
  ADD COLUMN percentage_snapshot numeric;
