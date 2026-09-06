-- Issue #204 -- tambah case_number auto-generate ke cases, ubah
-- quotation_number jadi turunan darinya (bukan counter independen
-- lagi).
--
-- Tujuan: Nomor Project -> Nomor RAB -> (nanti) Nomor Invoice harus
-- "nyambung", bisa ditelusuri cuma dari nomornya doang tanpa perlu
-- buka database.
--
-- Warisan nomor existing (buat v2/v3 negosiasi) TIDAK berubah -- RAB
-- yang lagi aktif sekarang tidak kesenggol sama sekali. quotation_number
-- yang SUDAH ADA juga tidak di-backfill/regenerasi -- nomor yang sudah
-- pernah dikirim ke client tidak boleh berubah nilainya.

begin;

-- ========================================================================
-- 1. Tabel counter case_number -- mirror persis quotation_number_counters
-- ========================================================================

create table public.case_number_counters (
  year int primary key,
  last_seq int not null default 0
);

alter table public.case_number_counters enable row level security;

create policy case_number_counters_admin_all
  on public.case_number_counters
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- ========================================================================
-- 2. Kolom baru cases.case_number
-- ========================================================================

alter table public.cases
  add column if not exists case_number text;

-- ========================================================================
-- 3. Trigger generate_case_number() -- BEFORE INSERT di cases
-- ========================================================================

create or replace function public.generate_case_number()
returns trigger
language plpgsql
security definer
as $$
declare
  service_code text;
  target_year int;
  next_seq int;
begin
  select code into service_code
  from public.service_type_codes
  where service_type = new.service_type;

  if service_code is null then
    service_code := upper(left(regexp_replace(coalesce(new.service_type, 'UMU'), '[^A-Za-z]', '', 'g'), 3));
    if service_code = '' then
      service_code := 'UMU';
    end if;
  end if;

  target_year := extract(year from coalesce(new.created_at, now()))::int;

  insert into public.case_number_counters (year, last_seq)
  values (target_year, 1)
  on conflict (year) do update
    set last_seq = public.case_number_counters.last_seq + 1
  returning last_seq into next_seq;

  new.case_number := 'SMA/' || to_char(coalesce(new.created_at, now()), 'YYYY-MM') || '/' || service_code || '/' || lpad(next_seq::text, 4, '0');

  return new;
end;
$$;

drop trigger if exists cases_generate_number on public.cases;

create trigger cases_generate_number
before insert on public.cases
for each row
execute function public.generate_case_number();

-- ========================================================================
-- 4. Backfill case_number untuk Case existing -- urut created_at ASC,
--    tahun-bulan ikut created_at row masing-masing (bukan now()), pakai
--    counter yang sama biar sequence-nya nyambung natural dengan Case
--    baru ke depan.
-- ========================================================================

do $$
declare
  rec record;
  service_code text;
  target_year int;
  next_seq int;
begin
  for rec in
    select id, service_type, created_at
    from public.cases
    where case_number is null
    order by created_at asc
  loop
    select code into service_code
    from public.service_type_codes
    where service_type = rec.service_type;

    if service_code is null then
      service_code := upper(left(regexp_replace(coalesce(rec.service_type, 'UMU'), '[^A-Za-z]', '', 'g'), 3));
      if service_code = '' then
        service_code := 'UMU';
      end if;
    end if;

    target_year := extract(year from rec.created_at)::int;

    insert into public.case_number_counters (year, last_seq)
    values (target_year, 1)
    on conflict (year) do update
      set last_seq = public.case_number_counters.last_seq + 1
    returning last_seq into next_seq;

    update public.cases
    set case_number = 'SMA/' || to_char(rec.created_at, 'YYYY-MM') || '/' || service_code || '/' || lpad(next_seq::text, 4, '0')
    where id = rec.id;
  end loop;
end $$;

-- ========================================================================
-- 5. Modifikasi generate_quotation_number() -- derive dari case_number
--    untuk case yang belum pernah punya quotation_number. Langkah warisan
--    nomor existing TIDAK berubah.
-- ========================================================================

create or replace function public.generate_quotation_number()
returns trigger
language plpgsql
security definer
as $$
declare
  existing_number text;
  case_number_value text;
begin
  select quotation_number into existing_number
  from public.case_quotations
  where case_id = new.case_id
    and quotation_number is not null
  order by version asc
  limit 1;

  if existing_number is not null then
    new.quotation_number := existing_number;
    return new;
  end if;

  select case_number into case_number_value
  from public.cases
  where id = new.case_id;

  -- Fallback ini seharusnya tidak pernah kepakai -- semua case (lama
  -- lewat backfill di atas, baru lewat trigger cases_generate_number)
  -- sudah pasti punya case_number di titik ini. Dipertahankan sebagai
  -- pengaman, bukan jalur normal.
  new.quotation_number := coalesce(case_number_value, 'SMA-UNKNOWN') || '-RAB';

  return new;
end;
$$;

commit;
