-- Corrective migration forward-only. Migration sebelumnya
-- (20260905130000_case_stages.sql) salah asumsi tabel case_stages belum
-- ada, dan tanpa sengaja menambahkan 2 policy yang melanggar desain asli
-- (PRD_Workflow_Layer_SMA-app.md §2.6, lihat migration 20260822160000):
-- internal role SEHARUSNYA cuma dapat SELECT+UPDATE, bukan INSERT/DELETE.
-- Migration ini mencabut kedua policy yang salah tersebut.

DROP POLICY IF EXISTS case_stages_internal_insert ON case_stages;
DROP POLICY IF EXISTS case_stages_internal_delete ON case_stages;
