-- Issue #219 -- Approve RAB mewakili client (sementara, sampai client
-- portal live) + matikan auto-generate payments dari
-- handle_quotation_response() (Issue #216/#218 menggantikannya dengan
-- generate invoice manual per-tahap, bukan sekaligus semua Termin saat
-- RAB di-ACCEPTED).

begin;

-- ========================================================================
-- 1. Kolom baru: jejak siapa & kapan admin/supervisor approve mewakili
--    client (paralel dengan internal_approved_by/internal_approved_at
--    yang sudah ada untuk approval internal).
-- ========================================================================

alter table public.case_quotations
  add column if not exists accepted_on_behalf_by uuid references public.profiles(id) on delete set null;

alter table public.case_quotations
  add column if not exists accepted_on_behalf_at timestamptz;

-- ========================================================================
-- 2. Perluas enforce_case_quotation_status_transition() -- izinkan
--    admin/supervisor transisi SENT -> ACCEPTED (mewakili client, sampai
--    client portal live), isi kolom baru di atas.
-- ========================================================================

create or replace function public.enforce_case_quotation_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_role text := public.auth_role();
  actor_id uuid := auth.uid();
begin
  if old.status in ('PENDING_INTERNAL_APPROVAL', 'APPROVED_INTERNAL')
     and (
       new.case_id is distinct from old.case_id
       or new.version is distinct from old.version
       or new.total_amount is distinct from old.total_amount
       or new.notes is distinct from old.notes
       or new.quotation_number is distinct from old.quotation_number
       or new.description is distinct from old.description
       or new.bank_account_id is distinct from old.bank_account_id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
     )
  then
    raise exception 'Quotation berstatus % bersifat read-only', old.status;
  end if;

  if new.status = old.status then
    if old.status in ('PENDING_INTERNAL_APPROVAL', 'APPROVED_INTERNAL')
       and new is distinct from old
    then
      raise exception 'Quotation berstatus % bersifat read-only', old.status;
    end if;
    return new;
  end if;

  if actor_role = 'client' then
    if old.status = 'SENT'
       and new.status in ('ACCEPTED', 'REJECTED', 'NEGOTIATING')
    then
      return new;
    end if;
    raise exception 'Transisi status quotation client tidak diizinkan: % -> %', old.status, new.status;
  end if;

  if actor_role not in ('admin', 'supervisor', 'internal') then
    raise exception 'Role tidak diizinkan mengubah status quotation';
  end if;

  if new.status = 'SUPERSEDED'
     and old.status in ('SENT', 'ACCEPTED', 'REJECTED', 'NEGOTIATING')
  then
    return new;
  end if;

  if old.status in ('DRAFT', 'REVISION_REQUIRED')
     and new.status = 'PENDING_INTERNAL_APPROVAL'
  then
    new.internal_submitted_by := actor_id;
    new.internal_submitted_at := now();
    new.internal_approved_by := null;
    new.internal_approved_at := null;
    return new;
  end if;

  if old.status = 'PENDING_INTERNAL_APPROVAL'
     and new.status = 'APPROVED_INTERNAL'
     and actor_role in ('admin', 'supervisor')
  then
    new.internal_approved_by := actor_id;
    new.internal_approved_at := now();
    return new;
  end if;

  if old.status = 'PENDING_INTERNAL_APPROVAL'
     and new.status = 'REVISION_REQUIRED'
     and actor_role in ('admin', 'supervisor')
  then
    if nullif(btrim(new.internal_revision_reason), '') is null then
      raise exception 'Alasan revisi wajib diisi';
    end if;
    new.internal_revision_requested_by := actor_id;
    new.internal_revision_requested_at := now();
    new.internal_approved_by := null;
    new.internal_approved_at := null;
    return new;
  end if;

  if old.status = 'APPROVED_INTERNAL'
     and new.status = 'REVISION_REQUIRED'
     and actor_role in ('admin', 'supervisor')
  then
    if nullif(btrim(new.internal_reopen_reason), '') is null then
      raise exception 'Alasan reopen wajib diisi';
    end if;
    new.internal_reopened_by := actor_id;
    new.internal_reopened_at := now();
    new.internal_approved_by := null;
    new.internal_approved_at := null;
    return new;
  end if;

  if old.status = 'APPROVED_INTERNAL'
     and new.status = 'SENT'
     and actor_role in ('admin', 'supervisor')
  then
    new.sent_at := coalesce(new.sent_at, now());
    return new;
  end if;

  if old.status = 'SENT'
     and new.status = 'REJECTED'
     and actor_role in ('admin', 'supervisor')
  then
    if nullif(btrim(new.rejection_reason), '') is null then
      raise exception 'Alasan penolakan wajib diisi';
    end if;
    return new;
  end if;

  -- BARU (Issue #219) -- admin/supervisor approve mewakili client,
  -- sementara sampai client portal live.
  if old.status = 'SENT'
     and new.status = 'ACCEPTED'
     and actor_role in ('admin', 'supervisor')
  then
    new.accepted_on_behalf_by := actor_id;
    new.accepted_on_behalf_at := now();
    new.responded_at := coalesce(new.responded_at, now());
    return new;
  end if;

  raise exception 'Transisi status quotation tidak diizinkan: % -> %', old.status, new.status;
end;
$$;

-- ========================================================================
-- 3. Matikan auto-generate payments di handle_quotation_response().
--    Invoice sekarang di-generate manual per-tahap lewat tombol di
--    Client Detail v2 (Issue #218), bukan sekaligus semua Termin saat
--    RAB ACCEPTED. Bagian cases.intake_status dan generate case_stages
--    TIDAK diubah -- di luar scope Issue #219.
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

commit;
