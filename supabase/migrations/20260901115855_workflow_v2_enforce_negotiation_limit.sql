-- Issue #157 — PRD Workflow Layer v2.0, Fase 2 (Approval)
-- Task 5/11 dari breakdown implementasi PRD_Workflow_Layer_SMA-app_v2.md
--
-- Trigger baru untuk menegakkan batas 3x siklus negosiasi RAB
-- (PRD §3.2). SENGAJA berupa trigger database, bukan logic di sisi
-- admin — tombol "Nego" diklik dari client portal (sisi Dimas), kalau
-- logic ini ditaruh di kode admin, tidak akan pernah kepanggil saat
-- client yang trigger perubahan. Trigger DB netral terhadap sisi mana
-- yang melakukan update.
--
-- VERIFIKASI SEBELUM MENULIS (C5P5): dicek isi
-- handle_quotation_response (trigger existing, AFTER UPDATE) via
-- pg_get_functiondef — function itu CUMA menangani transisi status
-- ke ACCEPTED dan REJECTED, tidak menyentuh NEGOTIATING sama sekali.
-- Trigger baru ini tidak overlap/duplikat logic dengan yang sudah ada.
--
-- Auto-reject setelah limit TIDAK butuh logic tambahan di sini —
-- begitu quotation di-set REJECTED (oleh admin, keputusan manual
-- setelah melihat limit tercapai), handle_quotation_response yang
-- sudah ada otomatis set cases.intake_status = REJECTED. Trigger ini
-- HANYA menolak transisi ke NEGOTIATING kalau limit sudah tercapai.

begin;

create or replace function public.enforce_negotiation_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'NEGOTIATING' then
    select negotiation_count into current_count
    from public.cases
    where id = new.case_id;

    if current_count >= 3 then
      raise exception 'Batas negosiasi (3x) sudah tercapai untuk case ini.';
    end if;

    update public.cases
    set negotiation_count = negotiation_count + 1
    where id = new.case_id;
  end if;

  return new;
end;
$$;

comment on function public.enforce_negotiation_limit() is
  'Menolak transisi case_quotations.status ke NEGOTIATING kalau '
  'cases.negotiation_count sudah >= 3, dan increment counter kalau '
  'masih diizinkan. PRD_Workflow_Layer_SMA-app_v2.md §3.2, Task 5/11.';

create trigger case_quotations_enforce_negotiation_limit
  before update on public.case_quotations
  for each row
  execute function public.enforce_negotiation_limit();

commit;
