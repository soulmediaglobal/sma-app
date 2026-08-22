-- Skema inti workflow engine generik (Issue #33): workflow_templates,
-- workflow_template_stages, workflow_instances, workflow_stages.
--
-- Scope: DB schema only. Tidak menyentuh cases.status atau kolom existing
-- tabel manapun, tidak ada perubahan frontend/JS. workflow_actions dan
-- workflow_transitions sengaja TIDAK dibuat di sini (task terpisah).
--
-- Pola RLS mengikuti audit manual terhadap pg_policies pada `cases` dan
-- `case_assignees` (bukan tebakan):
--   cases:          admin ALL; supervisor select+update; internal
--                   select+insert+update; client select-own via client_id.
--   case_assignees: admin select/insert/delete; supervisor
--                   select/insert/delete; internal select-only; TIDAK ada
--                   policy client sama sekali (assignee bukan data yang
--                   ditampilkan ke client).
--
-- Deviasi yang disengaja dari pola case_assignees: workflow_stages dan
-- workflow_instances MENAMBAHKAN policy client select-own (via join ke
-- cases.client_id), karena SMA_APP_MASTER_ARCHITECTURE.js eksplisit
-- mensyaratkan client bisa melihat "Workflow Progress" di halaman project
-- mereka sendiri (clientProjectDetail.sections). Konfigurasi workflow
-- (workflow_templates/workflow_template_stages) TIDAK diberi akses client
-- sama sekali, karena roleOwnershipMatrix.CONFIGURE_WORKFLOW = ADMIN only.

begin;

-- ----------------------------------------------------------------------
-- workflow_templates — blueprint reusable per tipe project.
-- ----------------------------------------------------------------------

create table public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.workflow_templates enable row level security;

create policy workflow_templates_admin_all
  on public.workflow_templates
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy workflow_templates_supervisor_select
  on public.workflow_templates
  for select
  using (public.auth_role() = 'supervisor');

create policy workflow_templates_internal_select
  on public.workflow_templates
  for select
  using (public.auth_role() = 'internal');

-- ----------------------------------------------------------------------
-- workflow_template_stages — daftar stage dalam satu template.
-- ----------------------------------------------------------------------

create table public.workflow_template_stages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workflow_templates(id) on delete cascade,
  name text not null,
  sequence int not null,
  description text,
  created_at timestamptz not null default now(),
  unique (template_id, sequence)
);

create index workflow_template_stages_template_id_idx
  on public.workflow_template_stages(template_id);

alter table public.workflow_template_stages enable row level security;

create policy workflow_template_stages_admin_all
  on public.workflow_template_stages
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy workflow_template_stages_supervisor_select
  on public.workflow_template_stages
  for select
  using (public.auth_role() = 'supervisor');

create policy workflow_template_stages_internal_select
  on public.workflow_template_stages
  for select
  using (public.auth_role() = 'internal');

-- ----------------------------------------------------------------------
-- workflow_instances — copy workflow per project (`cases`), boleh
-- divergen dari template aslinya.
-- ----------------------------------------------------------------------

create table public.workflow_instances (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  template_id uuid references public.workflow_templates(id) on delete set null,
  name text not null,
  status text not null default 'ACTIVE'
    check (status in ('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now()
);

create index workflow_instances_case_id_idx
  on public.workflow_instances(case_id);

create index workflow_instances_template_id_idx
  on public.workflow_instances(template_id);

alter table public.workflow_instances enable row level security;

create policy workflow_instances_admin_all
  on public.workflow_instances
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy workflow_instances_supervisor_select
  on public.workflow_instances
  for select
  using (public.auth_role() = 'supervisor');

create policy workflow_instances_supervisor_update
  on public.workflow_instances
  for update
  using (public.auth_role() = 'supervisor')
  with check (public.auth_role() = 'supervisor');

create policy workflow_instances_internal_select
  on public.workflow_instances
  for select
  using (public.auth_role() = 'internal');

create policy workflow_instances_internal_insert
  on public.workflow_instances
  for insert
  with check (public.auth_role() = 'internal');

create policy workflow_instances_internal_update
  on public.workflow_instances
  for update
  using (public.auth_role() = 'internal')
  with check (public.auth_role() = 'internal');

create policy workflow_instances_client_select_own
  on public.workflow_instances
  for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.cases c
      where c.id = workflow_instances.case_id
        and c.client_id = public.auth_client_id()
    )
  );

-- ----------------------------------------------------------------------
-- workflow_stages — stage instance milik satu workflow_instance
-- (di-copy dari workflow_template_stages, boleh divergen).
-- ----------------------------------------------------------------------

create table public.workflow_stages (
  id uuid primary key default gen_random_uuid(),
  workflow_instance_id uuid not null references public.workflow_instances(id) on delete cascade,
  template_stage_id uuid references public.workflow_template_stages(id) on delete set null,
  name text not null,
  sequence int not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'COMPLETED', 'SKIPPED', 'CANCELLED')),
  description text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workflow_instance_id, sequence)
);

create index workflow_stages_workflow_instance_id_idx
  on public.workflow_stages(workflow_instance_id);

alter table public.workflow_stages enable row level security;

create policy workflow_stages_admin_all
  on public.workflow_stages
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy workflow_stages_supervisor_select
  on public.workflow_stages
  for select
  using (public.auth_role() = 'supervisor');

create policy workflow_stages_supervisor_insert
  on public.workflow_stages
  for insert
  with check (public.auth_role() = 'supervisor');

create policy workflow_stages_supervisor_update
  on public.workflow_stages
  for update
  using (public.auth_role() = 'supervisor')
  with check (public.auth_role() = 'supervisor');

create policy workflow_stages_supervisor_delete
  on public.workflow_stages
  for delete
  using (public.auth_role() = 'supervisor');

create policy workflow_stages_internal_select
  on public.workflow_stages
  for select
  using (public.auth_role() = 'internal');

create policy workflow_stages_client_select_own
  on public.workflow_stages
  for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.workflow_instances wi
      join public.cases c on c.id = wi.case_id
      where wi.id = workflow_stages.workflow_instance_id
        and c.client_id = public.auth_client_id()
    )
  );

-- ----------------------------------------------------------------------
-- workflow_instances.current_stage_id — ditambahkan lewat ALTER karena
-- workflow_stages baru ada setelah workflow_instances dibuat di atas
-- (dependency melingkar: instance -> stage -> balik ke instance).
-- ----------------------------------------------------------------------

alter table public.workflow_instances
  add column current_stage_id uuid references public.workflow_stages(id) on delete set null;

commit;
