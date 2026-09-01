-- Issue #155 — PRD Workflow Layer v2.0, Fase 4 (Finalisasi)
-- Task 3/11 dari breakdown implementasi PRD_Workflow_Layer_SMA-app_v2.md
--
-- Tabel baru case_handover_documents — dokumen serah terima.
--
-- KEPUTUSAN DESAIN: summary adalah SNAPSHOT (jsonb), bukan live-query.
-- Begitu digenerate, isi dokumen tidak boleh berubah meski data
-- project (payments/documents/dst) berubah setelahnya — dokumen
-- historis harus tetap merepresentasikan kondisi PERSIS saat
-- di-generate. Struktur detail jsonb diserahkan ke task 11 (UI
-- generate) untuk didefinisikan, migration ini cuma sediakan kolomnya.
--
-- KEPUTUSAN OTORITAS: generate (INSERT) dibatasi admin+supervisor,
-- BUKAN internal — mengikuti pola otoritas yang sama dengan transisi
-- kritis lain di app ini (mis. quotation DRAFT->SENT juga admin/
-- supervisor-only, lihat case_quotations_internal_update yang
-- membatasi internal ke status DRAFT saja). Finalisasi project adalah
-- transisi akhir yang setara signifikansinya. internal tetap bisa
-- SELECT (lihat dokumen yang sudah dibuat), cuma tidak bisa membuat.
--
-- client_confirmed_at/client_confirmed_ip: PLACEHOLDER untuk mekanisme
-- pengganti tanda tangan digital. PRD_Workflow_Layer_SMA-app_v2.md §5
-- eksplisit menandai ini "BELUM FINAL" — struktur kolom ini baseline
-- MVP (checkbox+timestamp+IP), kemungkinan perlu revisi setelah
-- keputusan final soal kekuatan hukumnya (di luar scope migration ini
-- untuk memutuskan).

begin;

create table public.case_handover_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  document_number text not null unique,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id) on delete set null,
  summary jsonb not null,
  client_confirmed_at timestamptz,
  client_confirmed_ip text,
  created_at timestamptz not null default now()
);

comment on table public.case_handover_documents is
  'Dokumen serah terima per case, PRD_Workflow_Layer_SMA-app_v2.md §5. '
  'summary adalah SNAPSHOT jsonb di titik generate, bukan live-join — '
  'lihat catatan migration untuk alasan desain.';

comment on column public.case_handover_documents.summary is
  'Snapshot data saat generate: tanggal mulai/finalisasi, daftar step, '
  'tanggal+invoice/kuitansi tiap termin, daftar dokumen diserahkan, '
  'PIC/staff. Struktur detail didefinisikan di task 11 (UI generate).';

comment on column public.case_handover_documents.client_confirmed_at is
  'PLACEHOLDER pengganti tanda tangan — belum final, lihat PRD §5. '
  'NULL berarti client belum konfirmasi.';

create index idx_case_handover_documents_case_id
  on public.case_handover_documents(case_id);

alter table public.case_handover_documents enable row level security;

create policy "case_handover_documents_admin_all"
  on public.case_handover_documents
  for all
  using (auth_role() = 'admin')
  with check (auth_role() = 'admin');

create policy "case_handover_documents_supervisor_select"
  on public.case_handover_documents
  for select
  using (auth_role() = 'supervisor');

create policy "case_handover_documents_supervisor_insert"
  on public.case_handover_documents
  for insert
  with check (auth_role() = 'supervisor');

create policy "case_handover_documents_internal_select"
  on public.case_handover_documents
  for select
  using (auth_role() = 'internal');

create policy "case_handover_documents_client_select_own"
  on public.case_handover_documents
  for select
  using (
    auth_role() = 'client'
    and exists (
      select 1 from public.cases c
      where c.id = case_handover_documents.case_id
        and c.client_id = auth_client_id()
    )
  );

create policy "case_handover_documents_client_confirm_own"
  on public.case_handover_documents
  for update
  using (
    auth_role() = 'client'
    and client_confirmed_at is null
    and exists (
      select 1 from public.cases c
      where c.id = case_handover_documents.case_id
        and c.client_id = auth_client_id()
    )
  )
  with check (
    client_confirmed_at is not null
    and exists (
      select 1 from public.cases c
      where c.id = case_handover_documents.case_id
        and c.client_id = auth_client_id()
    )
  );

create or replace function public.prevent_client_handover_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth_role() != 'client' then
    return new;
  end if;

  if new.case_id is distinct from old.case_id
     or new.document_number is distinct from old.document_number
     or new.generated_at is distinct from old.generated_at
     or new.generated_by is distinct from old.generated_by
     or new.summary is distinct from old.summary
  then
    raise exception 'Client hanya boleh mengisi konfirmasi, tidak kolom lain.';
  end if;

  return new;
end;
$$;

create trigger case_handover_documents_prevent_client_tampering
  before update on public.case_handover_documents
  for each row
  execute function public.prevent_client_handover_tampering();

commit;
