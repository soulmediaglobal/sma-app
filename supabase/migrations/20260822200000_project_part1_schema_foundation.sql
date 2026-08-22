-- Issue #42 — PROJECT, Part I: Schema Foundation.
-- Fondasi buat fitur "PROJECT — Intake & RAB Workflow" (7 part, lihat
-- PRD_Project_Intake_RAB_Workflow_SMA-app.md). SCHEMA ONLY — tidak ada
-- perubahan frontend/JS, tidak ada trigger yang auto-generate payments/
-- case_stages dari quotation (itu Part VI).
--
-- Pola RLS ngikutin yang sudah didokumentasikan di
-- 20260822160000_replace_workflow_engine_with_case_stages.sql (audit
-- pg_policies existing, bukan tebakan): admin ALL; supervisor
-- setara-atau-mendekati admin; internal lebih terbatas; client
-- SELECT-only lewat join ke cases.client_id.

begin;

-- ========================================================================
-- 1. document_templates — master jenis dokumen (konfigurasi internal,
--    tidak ada akses client sama sekali)
-- ========================================================================

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  default_service_types text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.document_templates enable row level security;

create policy document_templates_admin_all
  on public.document_templates
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy document_templates_supervisor_select
  on public.document_templates
  for select
  using (public.auth_role() = 'supervisor');

create policy document_templates_internal_select
  on public.document_templates
  for select
  using (public.auth_role() = 'internal');

-- ========================================================================
-- 2. case_quotations — RAB/penawaran header, versioned
-- ========================================================================

create table public.case_quotations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  version int not null default 1,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'NEGOTIATING', 'SUPERSEDED')),
  total_amount numeric not null default 0,
  notes text,
  sent_at timestamptz,
  responded_at timestamptz,
  client_response_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (case_id, version)
);

create index case_quotations_case_id_idx on public.case_quotations(case_id);

alter table public.case_quotations enable row level security;

create policy case_quotations_admin_all
  on public.case_quotations
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy case_quotations_supervisor_select
  on public.case_quotations
  for select
  using (public.auth_role() = 'supervisor');

create policy case_quotations_supervisor_insert
  on public.case_quotations
  for insert
  with check (public.auth_role() = 'supervisor');

create policy case_quotations_supervisor_update
  on public.case_quotations
  for update
  using (public.auth_role() = 'supervisor')
  with check (public.auth_role() = 'supervisor');

create policy case_quotations_internal_select
  on public.case_quotations
  for select
  using (public.auth_role() = 'internal');

create policy case_quotations_internal_insert
  on public.case_quotations
  for insert
  with check (public.auth_role() = 'internal');

create policy case_quotations_internal_update
  on public.case_quotations
  for update
  using (public.auth_role() = 'internal')
  with check (public.auth_role() = 'internal');

-- Client SELECT-only untuk task ini. Akses tulis (Terima/Tolak/Nego)
-- SENGAJA ditunda ke Part VI — logic keamanan transisi status belum
-- dibangun, memberi write access sekarang prematur.
create policy case_quotations_client_select_own
  on public.case_quotations
  for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.cases c
      where c.id = case_quotations.case_id
        and c.client_id = public.auth_client_id()
    )
  );

-- ========================================================================
-- 3. case_quotation_items — rincian termin per quotation
-- ========================================================================

create table public.case_quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.case_quotations(id) on delete cascade,
  term_name text not null,
  amount numeric not null,
  due_condition text,
  order_index int not null,
  unique (quotation_id, order_index)
);

create index case_quotation_items_quotation_id_idx on public.case_quotation_items(quotation_id);

alter table public.case_quotation_items enable row level security;

create policy case_quotation_items_admin_all
  on public.case_quotation_items
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy case_quotation_items_supervisor_select
  on public.case_quotation_items
  for select
  using (public.auth_role() = 'supervisor');

create policy case_quotation_items_supervisor_insert
  on public.case_quotation_items
  for insert
  with check (public.auth_role() = 'supervisor');

create policy case_quotation_items_supervisor_update
  on public.case_quotation_items
  for update
  using (public.auth_role() = 'supervisor')
  with check (public.auth_role() = 'supervisor');

create policy case_quotation_items_supervisor_delete
  on public.case_quotation_items
  for delete
  using (public.auth_role() = 'supervisor');

create policy case_quotation_items_internal_select
  on public.case_quotation_items
  for select
  using (public.auth_role() = 'internal');

create policy case_quotation_items_internal_insert
  on public.case_quotation_items
  for insert
  with check (public.auth_role() = 'internal');

create policy case_quotation_items_internal_update
  on public.case_quotation_items
  for update
  using (public.auth_role() = 'internal')
  with check (public.auth_role() = 'internal');

create policy case_quotation_items_internal_delete
  on public.case_quotation_items
  for delete
  using (public.auth_role() = 'internal');

create policy case_quotation_items_client_select_own
  on public.case_quotation_items
  for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.case_quotations q
      join public.cases c on c.id = q.case_id
      where q.id = case_quotation_items.quotation_id
        and c.client_id = public.auth_client_id()
    )
  );

-- ========================================================================
-- 4. cases.intake_status
-- ========================================================================
-- Terpisah dari cases.status (Baru/Proses/Selesai/Batal) yang sudah
-- diotomasi lewat trigger sync_case_status_from_stages (Issue #38).
-- intake_status jadi gerbang sebelum case_stages mulai ada isinya.
--
-- 42 case existing akan dapat default 'DRAFT' dari migration ini —
-- Part II (task terpisah) akan retroaktif set ke 'ACCEPTED' karena
-- mereka sudah punya case_stages / sedang berjalan.

alter table public.cases
  add column intake_status text not null default 'DRAFT'
    check (intake_status in ('DRAFT', 'QUOTED', 'ACCEPTED', 'REJECTED'));

commit;
