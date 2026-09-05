-- Tabel baru: Tahapan Pekerjaan, terikat ke Case (bukan ke RAB/quotation),
-- dipakai bareng oleh semua versi RAB dalam Case yang sama. Issue #177.

CREATE TABLE case_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL,
  UNIQUE (case_id, order_index)
);

CREATE INDEX case_stages_case_id_idx ON case_stages(case_id);

ALTER TABLE case_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_stages_admin_all ON case_stages
  FOR ALL
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY case_stages_supervisor_all ON case_stages
  FOR ALL
  USING (auth_role() = 'supervisor')
  WITH CHECK (auth_role() = 'supervisor');

CREATE POLICY case_stages_internal_select ON case_stages
  FOR SELECT
  USING (auth_role() = 'internal');

CREATE POLICY case_stages_internal_insert ON case_stages
  FOR INSERT
  WITH CHECK (auth_role() = 'internal');

CREATE POLICY case_stages_internal_update ON case_stages
  FOR UPDATE
  USING (auth_role() = 'internal')
  WITH CHECK (auth_role() = 'internal');

CREATE POLICY case_stages_internal_delete ON case_stages
  FOR DELETE
  USING (auth_role() = 'internal');

CREATE POLICY case_stages_client_select_own ON case_stages
  FOR SELECT
  USING (
    auth_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_stages.case_id
        AND c.client_id = auth_client_id()
    )
  );
