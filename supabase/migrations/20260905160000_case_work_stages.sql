-- Tahapan Pekerjaan — KHUSUS anchor Termin Pembayaran, bebas
-- ditambah/dihapus/diurutkan per Case (fleksibel, mirip Rincian
-- Pekerjaan). Ini BEDA dari case_stages (tab Workflow, fixed generic
-- template, sementara di-nonaktifkan — lihat client-workflow.js).
-- Issue #177.

CREATE TABLE case_work_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL,
  UNIQUE (case_id, order_index)
);

CREATE INDEX case_work_stages_case_id_idx ON case_work_stages(case_id);

ALTER TABLE case_work_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_work_stages_admin_all ON case_work_stages
  FOR ALL
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY case_work_stages_supervisor_all ON case_work_stages
  FOR ALL
  USING (auth_role() = 'supervisor')
  WITH CHECK (auth_role() = 'supervisor');

-- Beda dari case_stages: internal dapat akses ALL (bukan cuma
-- SELECT+UPDATE), karena tabel ini memang didesain bebas
-- ditambah/dihapus/diurutkan langsung dari modal RAB oleh internal.
CREATE POLICY case_work_stages_internal_all ON case_work_stages
  FOR ALL
  USING (auth_role() = 'internal')
  WITH CHECK (auth_role() = 'internal');

CREATE POLICY case_work_stages_client_select_own ON case_work_stages
  FOR SELECT
  USING (
    auth_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_work_stages.case_id
        AND c.client_id = auth_client_id()
    )
  );

-- Alihkan relasi stage_id di case_quotation_items dari case_stages
-- (salah paham scope awal, lihat diskusi Issue #177) ke
-- case_work_stages. 0 row memakainya sejauh ini, aman tanpa backfill.
ALTER TABLE case_quotation_items DROP CONSTRAINT case_quotation_items_stage_id_fkey;
ALTER TABLE case_quotation_items
  ADD CONSTRAINT case_quotation_items_stage_id_fkey
  FOREIGN KEY (stage_id) REFERENCES case_work_stages(id) ON DELETE SET NULL;
