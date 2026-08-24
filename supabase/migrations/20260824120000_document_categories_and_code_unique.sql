-- Issue #94 — Project Setting: Kategori Dokumen CRUD + Kode Layanan
-- Unique (schema). Lanjutan restrukturisasi #91.

begin;

-- ========================================================================
-- 1. document_categories — bisa di-CRUD, gantikan category text bebas
-- ========================================================================

create table public.document_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.document_categories enable row level security;

create policy document_categories_admin_all
  on public.document_categories
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy document_categories_supervisor_select
  on public.document_categories
  for select
  using (public.auth_role() = 'supervisor');

create policy document_categories_internal_select
  on public.document_categories
  for select
  using (public.auth_role() = 'internal');

insert into public.document_categories (name, order_index) values
  ('Identitas', 1),
  ('Legalitas', 2),
  ('Teknis', 3),
  ('Keuangan', 4);

-- ========================================================================
-- 2. document_templates.category (text) -> category_id (FK)
-- ========================================================================

alter table public.document_templates
  add column category_id uuid references public.document_categories(id);

update public.document_templates dt
set category_id = dc.id
from public.document_categories dc
where dc.name = dt.category;

-- Kategori manapun yang belum kebackfill (harusnya tidak ada, tapi
-- jaga-jaga) masuk ke kategori pertama daripada dibiarkan NULL.
update public.document_templates
set category_id = (select id from public.document_categories order by order_index limit 1)
where category_id is null;

alter table public.document_templates
  alter column category_id set not null;

alter table public.document_templates
  drop column category;

-- ========================================================================
-- 3. service_type_codes.code — tambah UNIQUE constraint
-- ========================================================================

alter table public.service_type_codes
  add constraint service_type_codes_code_unique unique (code);

commit;
