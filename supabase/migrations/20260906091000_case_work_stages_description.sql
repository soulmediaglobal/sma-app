-- Issue #187: tambah kolom description (opsional) di case_work_stages,
-- supaya tiap Tahapan Pekerjaan punya penjelasan selain nama.
ALTER TABLE case_work_stages
  ADD COLUMN description text;
