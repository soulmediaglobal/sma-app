-- Issue #46 (fix tambahan) — kolom cases.created_by ("Project Creator"),
-- pengganti tampilan PIC (cases.assigned_to) di UI tab Project.
--
-- assigned_to dan trigger cases_prevent_internal_pic_reassignment
-- SENGAJA TIDAK dihapus — cuma berhenti ditampilkan/dipakai di UI.
-- Datanya tetap ada di database kalau nanti dibutuhkan lagi.
--
-- created_by beda konsep dari Tim Internal (case_assignees): ini siapa
-- yang MEMBUAT project (fixed, ke-set sekali pas project dibuat, tidak
-- bisa diubah lewat UI normal), bukan siapa yang mengerjakan (yang itu
-- fleksibel, bisa ditambah/dihapus kapan saja lewat case_assignees).

begin;

alter table public.cases
  add column created_by uuid references public.profiles(id) on delete set null;

-- Rekonsiliasi retroaktif untuk 43 case existing: karena data lama
-- tidak mencatat siapa pembuatnya secara eksplisit, dan cuma ada 1
-- user (Ray, admin) di sistem sepanjang data ini dibuat, isi created_by
-- dengan Ray untuk semua case yang belum punya nilai.
update public.cases
set created_by = (select id from public.profiles where role = 'admin' limit 1)
where created_by is null;

commit;
