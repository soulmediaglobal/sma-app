-- Issue #210 -- Workflow: tambah status + hierarki sub-tahap ke
-- case_work_stages.
--
-- Prasyarat buat: progress % asli di Client Detail v2 (sekarang masih
-- placeholder), tab Workflow beneran (sekarang "sedang maintenance"),
-- dan konteks tahap di section Pembayaran ("Termin 2 tertagih setelah
-- Tahap 3 selesai -- masih berjalan").
--
-- Keputusan desain (disepakati bareng Ray):
-- - 4 status: PENDING / IN_PROGRESS / DONE / BLOCKED
-- - Hierarki 2 level: Tahap utama -> Sub-tahap (tidak lebih dalam)
-- - Semi-otomatis: tahap induk auto DONE kalau SEMUA sub-tahapnya
--   DONE; kalau ada sub-tahap yang tidak lagi DONE, induk otomatis
--   lepas dari DONE juga
-- - Tahap tanpa sub-tahap (leaf) statusnya diubah manual oleh
--   internal (tombol UI -- issue terpisah, depends on ini)

begin;

-- ========================================================================
-- 1. Kolom status + parent_stage_id
-- ========================================================================

alter table public.case_work_stages
  add column status text not null default 'PENDING'
    check (status in ('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED')),
  add column parent_stage_id uuid references public.case_work_stages(id) on delete cascade;

create index case_work_stages_parent_stage_id_idx
  on public.case_work_stages(parent_stage_id);

-- ========================================================================
-- 2. Ganti UNIQUE(case_id, order_index) jadi 2 partial index --
--    NULL tidak dianggap "sama" oleh Postgres, jadi constraint
--    gabungan naif (case_id, parent_stage_id, order_index) bakal
--    kehilangan proteksi duplikat order_index buat tahap utama
--    (parent_stage_id IS NULL, karena NULL != NULL di pengecekan
--    uniqueness).
-- ========================================================================

alter table public.case_work_stages
  drop constraint case_work_stages_case_id_order_index_key;

create unique index case_work_stages_top_level_order_idx
  on public.case_work_stages(case_id, order_index)
  where parent_stage_id is null;

create unique index case_work_stages_sub_stage_order_idx
  on public.case_work_stages(case_id, parent_stage_id, order_index)
  where parent_stage_id is not null;

-- ========================================================================
-- 3. Trigger sinkronisasi status tahap induk -- cuma 1 arah ke atas
--    (2 level hierarki, tidak perlu rekursi). Aman dari infinite loop:
--    tahap utama (parent_stage_id NULL) langsung return early begitu
--    trigger ini kepicu ulang oleh UPDATE yang dilakukannya sendiri.
-- ========================================================================

create or replace function public.sync_parent_stage_status()
returns trigger
language plpgsql
security definer
as $$
declare
  target_parent_id uuid;
  total_children int;
  done_children int;
begin
  target_parent_id := coalesce(new.parent_stage_id, old.parent_stage_id);
  if target_parent_id is null then
    return coalesce(new, old);
  end if;

  select count(*), count(*) filter (where status = 'DONE')
    into total_children, done_children
    from public.case_work_stages
    where parent_stage_id = target_parent_id;

  if total_children > 0 and done_children = total_children then
    update public.case_work_stages
      set status = 'DONE'
      where id = target_parent_id and status <> 'DONE';
  else
    update public.case_work_stages
      set status = 'PENDING'
      where id = target_parent_id and status = 'DONE';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists case_work_stages_sync_parent on public.case_work_stages;

create trigger case_work_stages_sync_parent
after insert or update of status or delete on public.case_work_stages
for each row
execute function public.sync_parent_stage_status();

commit;
