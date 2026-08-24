-- Issue #70 — PROJECT, Part VI: Alur Terima/Tolak/Nego.
-- Menutup lingkaran 7-part PROJECT. SCHEMA ONLY — tidak ada UI baru
-- di sisi admin (tombol Terima/Tolak/Nego dibangun Dimas di sisi
-- client, mitra.soulmitra.id).

begin;

-- ========================================================================
-- 1. RLS write untuk client — UPDATE case_quotations MILIKNYA sendiri,
--    cuma dari status SENT, cuma boleh transisi ke 3 status.
-- ========================================================================

create policy case_quotations_client_update_own
  on public.case_quotations
  for update
  using (
    public.auth_role() = 'client'
    and status = 'SENT'
    and exists (
      select 1 from public.cases c
      where c.id = case_quotations.case_id
        and c.client_id = public.auth_client_id()
    )
  )
  with check (
    status in ('ACCEPTED', 'REJECTED', 'NEGOTIATING')
    and exists (
      select 1 from public.cases c
      where c.id = case_quotations.case_id
        and c.client_id = public.auth_client_id()
    )
  );

-- ========================================================================
-- 2. Proteksi kolom — client cuma boleh ubah status/responded_at/
--    client_response_notes, TIDAK boleh ubah total_amount, items, dsb
--    lewat request yang sama. Pola sama seperti
--    profiles_prevent_privilege_escalation &
--    payments_prevent_invoice_receipt_tampering yang sudah ada.
-- ========================================================================

create or replace function public.prevent_client_quotation_tampering()
returns trigger
language plpgsql
security definer
as $$
begin
  if public.auth_role() = 'client'
     and (
       new.case_id is distinct from old.case_id
       or new.version is distinct from old.version
       or new.total_amount is distinct from old.total_amount
       or new.quotation_number is distinct from old.quotation_number
       or new.description is distinct from old.description
       or new.notes is distinct from old.notes
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.sent_at is distinct from old.sent_at
     )
  then
    raise exception 'Client hanya boleh mengubah status, responded_at, dan client_response_notes';
  end if;

  return new;
end;
$$;

drop trigger if exists case_quotations_prevent_client_tampering on public.case_quotations;

create trigger case_quotations_prevent_client_tampering
before update on public.case_quotations
for each row
execute function public.prevent_client_quotation_tampering();

-- ========================================================================
-- 3. Trigger otomasi saat status berubah jadi ACCEPTED / REJECTED
-- ========================================================================

create or replace function public.handle_quotation_response()
returns trigger
language plpgsql
security definer
as $$
declare
  stage_names text[] := array[
    'Pengumpulan Dokumen', 'Verifikasi Dokumen', 'Revisi Dokumen',
    'Proses Administrasi', 'Pembayaran', 'Selesai'
  ];
  stage_owners text[] := array['CLIENT', 'ADMIN', 'CLIENT', 'ADMIN', 'CLIENT', 'SYSTEM'];
  i int;
  first_stage_id uuid;
  new_stage_id uuid;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'ACCEPTED' then
    update public.cases
    set intake_status = 'ACCEPTED'
    where id = new.case_id;

    -- Generate payments dari termin (case_quotation_items)
    insert into public.payments (case_id, amount, type, status)
    select new.case_id, amount, term_name, 'Pending'
    from public.case_quotation_items
    where quotation_id = new.id
    order by order_index;

    -- Generate case_stages HANYA kalau case ini belum pernah punya
    -- (idempotent — jaga-jaga kalau trigger somehow fire dua kali)
    if not exists (select 1 from public.case_stages where case_id = new.case_id) then
      first_stage_id := null;

      for i in 1..6 loop
        new_stage_id := gen_random_uuid();

        insert into public.case_stages (id, case_id, name, order_index, status, owner)
        values (new_stage_id, new.case_id, stage_names[i], i, 'PENDING', stage_owners[i]);

        if i = 1 then
          first_stage_id := new_stage_id;
        end if;
      end loop;

      update public.cases
      set current_stage_id = first_stage_id
      where id = new.case_id;
    end if;

  elsif new.status = 'REJECTED' then
    update public.cases
    set intake_status = 'REJECTED'
    where id = new.case_id;
  end if;

  return new;
end;
$$;

drop trigger if exists case_quotations_handle_response on public.case_quotations;

create trigger case_quotations_handle_response
after update on public.case_quotations
for each row
execute function public.handle_quotation_response();

commit;
