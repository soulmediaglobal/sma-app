-- Issue #62 (fase 1/2) — trigger generate quotation_number otomatis.
--
-- Aturan (dikonfirmasi Ray, lihat SPEC_PROJECT_Part_V2_RAB_Formal.md):
--   - Format: SMA/{YYYY-MM}/{kode layanan 3 huruf}/{urutan 4 digit}
--   - Nomor digenerate SEKALI per rangkaian negosiasi (case_id) — saat
--     versi pertama dibuat. Versi berikutnya (v2, v3 hasil Nego)
--     MEWARISI nomor yang sama, tidak pernah digenerate ulang.
--   - Urutan adalah counter GLOBAL per tahun (bukan per bulan, bukan
--     per jenis layanan) — pakai tabel counter dengan UPSERT atomik
--     supaya aman dari race condition kalau 2 quotation dibuat
--     bersamaan.

begin;

-- ========================================================================
-- Tabel counter — 1 baris per tahun, di-increment atomik
-- ========================================================================

create table public.quotation_number_counters (
  year int primary key,
  last_seq int not null default 0
);

alter table public.quotation_number_counters enable row level security;

-- Tabel internal murni, tidak pernah diakses langsung dari frontend
-- (cuma disentuh trigger function via SECURITY DEFINER) — admin-only
-- sebagai default aman kalau suatu saat perlu dicek manual.
create policy quotation_number_counters_admin_all
  on public.quotation_number_counters
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- ========================================================================
-- Trigger function
-- ========================================================================

create or replace function public.generate_quotation_number()
returns trigger
language plpgsql
security definer
as $$
declare
  existing_number text;
  service_code text;
  case_service_type text;
  current_year int;
  next_seq int;
begin
  -- 1. Kalau case_id ini SUDAH punya quotation sebelumnya, warisi
  --    nomornya — jangan generate baru (ini versi ke-2+ dari rangkaian
  --    negosiasi yang sama).
  select quotation_number into existing_number
  from public.case_quotations
  where case_id = new.case_id
  limit 1;

  if existing_number is not null then
    new.quotation_number := existing_number;
    return new;
  end if;

  -- 2. Rangkaian baru — generate nomor baru.
  select service_type into case_service_type
  from public.cases
  where id = new.case_id;

  select code into service_code
  from public.service_type_codes
  where service_type = case_service_type;

  -- Fallback kalau service_type belum ada di mapping (belum sempat
  -- ditambahkan admin) — pakai 3 huruf pertama, bukan gagal total.
  if service_code is null then
    service_code := upper(left(regexp_replace(coalesce(case_service_type, 'UMU'), '[^A-Za-z]', '', 'g'), 3));
    if service_code = '' then
      service_code := 'UMU';
    end if;
  end if;

  current_year := extract(year from now())::int;

  insert into public.quotation_number_counters (year, last_seq)
  values (current_year, 1)
  on conflict (year) do update
    set last_seq = public.quotation_number_counters.last_seq + 1
  returning last_seq into next_seq;

  new.quotation_number := 'SMA/' || to_char(now(), 'YYYY-MM') || '/' || service_code || '/' || lpad(next_seq::text, 4, '0');

  return new;
end;
$$;

drop trigger if exists case_quotations_generate_number on public.case_quotations;

create trigger case_quotations_generate_number
before insert on public.case_quotations
for each row
execute function public.generate_quotation_number();

commit;
