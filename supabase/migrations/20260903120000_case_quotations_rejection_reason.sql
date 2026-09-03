-- Issue #161 — alasan penolakan RAB dari sisi admin/supervisor.
-- Memperluas transition guard Issue #165 tanpa menambah RPC atau policy.

begin;

alter table public.case_quotations
  add column if not exists rejection_reason text;

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

  raise exception 'Transisi status quotation tidak diizinkan: % -> %', old.status, new.status;
end;
$$;

commit;
