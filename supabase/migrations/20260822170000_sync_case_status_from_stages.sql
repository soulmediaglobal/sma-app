-- Issue #38 — cases.status disinkronkan otomatis dari case_stages,
-- BUKAN digantikan. Keputusan final PRD_Workflow_Layer_SMA-app.md §4
-- poin 3: status lama tetap dipertahankan sebagai ringkasan level-atas
-- (biar UI existing — STATUS_BADGE, dropdown, filter list — tetap jalan
-- tanpa perubahan), tapi dihitung ulang dari kondisi case_stages
-- TERKINI setiap kali ada perubahan, bukan cuma progress maju.
--
-- Ini penting buat kasus back-and-forth (revisi/mundur stage) yang
-- menurut Ray cukup sering terjadi — status harus selalu mencerminkan
-- kondisi SEKARANG, bukan "status tertinggi yang pernah dicapai".
--
-- Aturan:
--   - Semua stage PENDING (atau belum ada stage sama sekali) -> Baru
--   - Semua stage COMPLETED/SKIPPED                          -> Selesai
--   - Selain itu (campuran/IN_PROGRESS/WAITING/BLOCKED)       -> Proses
--   - status = 'Batal' TIDAK PERNAH ditimpa otomatis — itu keputusan
--     manual eksplisit, bukan hasil hitungan progress.

begin;

create or replace function public.sync_case_status_from_stages()
returns trigger
language plpgsql
security definer
as $$
declare
  target_case_id uuid;
  computed_status text;
  total_count int;
  done_count int;
  pending_count int;
begin
  target_case_id := coalesce(new.case_id, old.case_id);

  select
    count(*),
    count(*) filter (where status in ('COMPLETED', 'SKIPPED')),
    count(*) filter (where status = 'PENDING')
  into total_count, done_count, pending_count
  from public.case_stages
  where case_id = target_case_id;

  if total_count = 0 or pending_count = total_count then
    computed_status := 'Baru';
  elsif done_count = total_count then
    computed_status := 'Selesai';
  else
    computed_status := 'Proses';
  end if;

  update public.cases
  set status = computed_status,
      updated_at = now()
  where id = target_case_id
    and status <> 'Batal';

  return null;
end;
$$;

drop trigger if exists case_stages_sync_case_status_insert on public.case_stages;
drop trigger if exists case_stages_sync_case_status_update on public.case_stages;
drop trigger if exists case_stages_sync_case_status_delete on public.case_stages;

create trigger case_stages_sync_case_status_insert
after insert on public.case_stages
for each row
execute function public.sync_case_status_from_stages();

create trigger case_stages_sync_case_status_update
after update of status on public.case_stages
for each row
execute function public.sync_case_status_from_stages();

create trigger case_stages_sync_case_status_delete
after delete on public.case_stages
for each row
execute function public.sync_case_status_from_stages();

commit;
