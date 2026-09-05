-- Termin Pembayaran sekarang wajib didefinisikan "sebelum/sesudah tahapan
-- X" (merujuk ke case_stages yang sudah ada). Kolom nullable di DB, validasi
-- wajib-isi cukup di level aplikasi (76 termin lama dibiarkan "belum diset"
-- sampai ada yang mengedit ulang). Issue #177.
--
-- required_before_line_item_id dihapus — desain lama yang tidak jadi
-- dipakai (referensi PRD_Workflow_Layer_SMA-app_v2.md §4.2 yang sudah
-- tidak relevan), dikonfirmasi 0 row memakainya.

ALTER TABLE case_quotation_items
  DROP COLUMN IF EXISTS required_before_line_item_id;

ALTER TABLE case_quotation_items
  ADD COLUMN stage_id uuid REFERENCES case_stages(id) ON DELETE SET NULL,
  ADD COLUMN relation_type text CHECK (relation_type IN ('BEFORE', 'AFTER'));

CREATE INDEX case_quotation_items_stage_id_idx ON case_quotation_items(stage_id) WHERE stage_id IS NOT NULL;
