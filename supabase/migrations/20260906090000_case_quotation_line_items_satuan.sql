-- Issue #186: tambah kolom satuan (unit tampilan seperti "orang",
-- "hari", "dokumen", dll) di case_quotation_line_items. Free text untuk
-- sekarang — sistem preset/dropdown Satuan yang dikonfigurasi di
-- halaman Project Setting direncanakan sebagai fitur terpisah, BUKAN
-- scope issue ini.
ALTER TABLE case_quotation_line_items
  ADD COLUMN satuan text;
