-- Issue #165 — Internal approval gate sebelum RAB dikirim ke client.
--
-- Lifecycle baru:
-- DRAFT / REVISION_REQUIRED -> PENDING_INTERNAL_APPROVAL
-- PENDING_INTERNAL_APPROVAL -> APPROVED_INTERNAL / REVISION_REQUIRED
-- APPROVED_INTERNAL -> SENT / REVISION_REQUIRED (explicit reopen)
--
-- Migration ini juga menutup gap RLS lama: client tidak boleh membaca
-- header, termin, atau rincian pekerjaan sebelum quotation berstatus SENT.

begin;

alter table public.case_quotations
  drop constraint if exists case_quotations_status_check;

alter table public.case_quotations
  add constraint case_quotations_status_check
  check (status in (
    'DRAFT',
    'PENDING_INTERNAL_APPROVAL',
    'REVISION_REQUIRED',
    'APPROVED_INTERNAL',
    'SENT',
    'ACCEPTED',
    'REJECTED',
    'NEGOTIATING',
    'SUPERSEDED'
  ));

alter table public.case_quotations
  add column if not exists internal_submitted_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists internal_submitted_at timestamptz,
  add column if not exists internal_approved_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists internal_approved_at timestamptz,
  add column if not exists internal_revision_requested_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists internal_revision_requested_at timestamptz,
  add column if not exists internal_revision_reason text,
  add column if not exists internal_reopened_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists internal_reopened_at timestamptz,
  add column if not exists internal_reopen_reason text;

create or replace function public.enforce_case_quotation_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_role text := public.auth_role();
  actor_id uuid := auth.uid();
  actor_created_case boolean := false;
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

  -- Integration point untuk Issue #161: migration #161 memberi policy
  -- UPDATE tambahan kepada internal project creator. Trigger ini tidak
  -- memberi akses sendiri, tetapi tidak akan memblokir policy tersebut.
  if old.status = 'SENT' and new.status = 'REJECTED' then
    if actor_role in ('admin', 'supervisor') then
      return new;
    end if;
    if actor_role = 'internal' then
      select exists (
        select 1
        from public.cases c
        where c.id = old.case_id
          and c.created_by = actor_id
      ) into actor_created_case;
      if actor_created_case then
        return new;
      end if;
    end if;
  end if;

  raise exception 'Transisi status quotation tidak diizinkan: % -> %', old.status, new.status;
end;
$$;

drop trigger if exists case_quotations_enforce_status_transition
  on public.case_quotations;

create trigger case_quotations_enforce_status_transition
before update on public.case_quotations
for each row
execute function public.enforce_case_quotation_status_transition();

-- Internal dapat mengedit DRAFT/REVISION_REQUIRED dan submit ke review,
-- tetapi tidak dapat approve, request revision, reopen, atau send.
drop policy if exists case_quotations_admin_all on public.case_quotations;
drop policy if exists case_quotations_admin_select on public.case_quotations;
drop policy if exists case_quotations_admin_insert on public.case_quotations;
drop policy if exists case_quotations_admin_update on public.case_quotations;
drop policy if exists case_quotations_admin_delete on public.case_quotations;
drop policy if exists case_quotations_supervisor_insert on public.case_quotations;

create policy case_quotations_admin_select
  on public.case_quotations for select
  using (public.auth_role() = 'admin');
create policy case_quotations_admin_insert
  on public.case_quotations for insert
  with check (public.auth_role() = 'admin' and status = 'DRAFT');
create policy case_quotations_admin_update
  on public.case_quotations for update
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');
create policy case_quotations_admin_delete
  on public.case_quotations for delete
  using (
    public.auth_role() = 'admin'
    and status in ('DRAFT', 'REVISION_REQUIRED')
  );

create policy case_quotations_supervisor_insert
  on public.case_quotations for insert
  with check (public.auth_role() = 'supervisor' and status = 'DRAFT');

drop policy if exists case_quotations_internal_update on public.case_quotations;

create policy case_quotations_internal_update
  on public.case_quotations
  for update
  using (
    public.auth_role() = 'internal'
    and status in ('DRAFT', 'REVISION_REQUIRED')
  )
  with check (
    public.auth_role() = 'internal'
    and status in ('DRAFT', 'REVISION_REQUIRED', 'PENDING_INTERNAL_APPROVAL')
  );

-- Item quotation hanya boleh ditulis saat header editable, termasuk oleh
-- admin/supervisor. Policy ALL admin lama harus dipecah karena policy RLS
-- bersifat permissive (OR) dan akan meniadakan edit lock bila dibiarkan.
drop policy if exists case_quotation_items_admin_all on public.case_quotation_items;
drop policy if exists case_quotation_items_admin_select on public.case_quotation_items;
drop policy if exists case_quotation_items_admin_insert on public.case_quotation_items;
drop policy if exists case_quotation_items_admin_update on public.case_quotation_items;
drop policy if exists case_quotation_items_admin_delete on public.case_quotation_items;
drop policy if exists case_quotation_items_supervisor_insert on public.case_quotation_items;
drop policy if exists case_quotation_items_supervisor_update on public.case_quotation_items;
drop policy if exists case_quotation_items_supervisor_delete on public.case_quotation_items;

create policy case_quotation_items_admin_select
  on public.case_quotation_items for select
  using (public.auth_role() = 'admin');
create policy case_quotation_items_admin_insert
  on public.case_quotation_items for insert
  with check (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_items_admin_update
  on public.case_quotation_items for update
  using (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  )
  with check (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_items_admin_delete
  on public.case_quotation_items for delete
  using (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );

create policy case_quotation_items_supervisor_insert
  on public.case_quotation_items for insert
  with check (
    public.auth_role() = 'supervisor'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_items_supervisor_update
  on public.case_quotation_items for update
  using (
    public.auth_role() = 'supervisor'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  )
  with check (
    public.auth_role() = 'supervisor'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_items_supervisor_delete
  on public.case_quotation_items for delete
  using (
    public.auth_role() = 'supervisor'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );

drop policy if exists case_quotation_items_internal_insert on public.case_quotation_items;
drop policy if exists case_quotation_items_internal_update on public.case_quotation_items;
drop policy if exists case_quotation_items_internal_delete on public.case_quotation_items;

create policy case_quotation_items_internal_insert
  on public.case_quotation_items for insert
  with check (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_items_internal_update
  on public.case_quotation_items for update
  using (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  )
  with check (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_items_internal_delete
  on public.case_quotation_items for delete
  using (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );

-- Terapkan write-lock yang sama ke rincian pekerjaan.
drop policy if exists case_quotation_line_items_admin_all on public.case_quotation_line_items;
drop policy if exists case_quotation_line_items_admin_select on public.case_quotation_line_items;
drop policy if exists case_quotation_line_items_admin_insert on public.case_quotation_line_items;
drop policy if exists case_quotation_line_items_admin_update on public.case_quotation_line_items;
drop policy if exists case_quotation_line_items_admin_delete on public.case_quotation_line_items;
drop policy if exists case_quotation_line_items_supervisor_insert on public.case_quotation_line_items;
drop policy if exists case_quotation_line_items_supervisor_update on public.case_quotation_line_items;
drop policy if exists case_quotation_line_items_supervisor_delete on public.case_quotation_line_items;
drop policy if exists case_quotation_line_items_internal_insert on public.case_quotation_line_items;
drop policy if exists case_quotation_line_items_internal_update on public.case_quotation_line_items;
drop policy if exists case_quotation_line_items_internal_delete on public.case_quotation_line_items;

create policy case_quotation_line_items_admin_select
  on public.case_quotation_line_items for select
  using (public.auth_role() = 'admin');

create policy case_quotation_line_items_admin_insert
  on public.case_quotation_line_items for insert
  with check (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_line_items_admin_update
  on public.case_quotation_line_items for update
  using (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  )
  with check (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_line_items_admin_delete
  on public.case_quotation_line_items for delete
  using (
    public.auth_role() = 'admin'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );

create policy case_quotation_line_items_supervisor_insert
  on public.case_quotation_line_items for insert
  with check (
    public.auth_role() = 'supervisor'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_line_items_supervisor_update
  on public.case_quotation_line_items for update
  using (
    public.auth_role() = 'supervisor'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  )
  with check (
    public.auth_role() = 'supervisor'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_line_items_supervisor_delete
  on public.case_quotation_line_items for delete
  using (
    public.auth_role() = 'supervisor'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );

create policy case_quotation_line_items_internal_insert
  on public.case_quotation_line_items for insert
  with check (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_line_items_internal_update
  on public.case_quotation_line_items for update
  using (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  )
  with check (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );
create policy case_quotation_line_items_internal_delete
  on public.case_quotation_line_items for delete
  using (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('DRAFT', 'REVISION_REQUIRED')
    )
  );

-- Client baru boleh melihat quotation dan children setelah dikirim.
drop policy if exists case_quotations_client_select_own on public.case_quotations;
create policy case_quotations_client_select_own
  on public.case_quotations for select
  using (
    public.auth_role() = 'client'
    and status in ('SENT', 'ACCEPTED', 'REJECTED', 'NEGOTIATING', 'SUPERSEDED')
    and exists (
      select 1 from public.cases c
      where c.id = case_quotations.case_id
        and c.client_id = public.auth_client_id()
    )
  );

drop policy if exists case_quotation_items_client_select_own on public.case_quotation_items;
create policy case_quotation_items_client_select_own
  on public.case_quotation_items for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.case_quotations q
      join public.cases c on c.id = q.case_id
      where q.id = case_quotation_items.quotation_id
        and q.status in ('SENT', 'ACCEPTED', 'REJECTED', 'NEGOTIATING', 'SUPERSEDED')
        and c.client_id = public.auth_client_id()
    )
  );

drop policy if exists case_quotation_line_items_client_select_own on public.case_quotation_line_items;
create policy case_quotation_line_items_client_select_own
  on public.case_quotation_line_items for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.case_quotations q
      join public.cases c on c.id = q.case_id
      where q.id = case_quotation_line_items.quotation_id
        and q.status in ('SENT', 'ACCEPTED', 'REJECTED', 'NEGOTIATING', 'SUPERSEDED')
        and c.client_id = public.auth_client_id()
    )
  );

commit;
