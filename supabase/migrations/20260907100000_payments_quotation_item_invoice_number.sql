-- Issue #216 -- Migration: link payments ke Termin RAB
-- (case_quotation_items) + auto-generate invoice_number.
--
-- payments.quotation_item_id menghubungkan pembayaran ke Termin RAB
-- spesifik. Satu Termin cuma boleh punya 1 invoice aktif (unique
-- partial index). invoice_number di-generate otomatis HANYA untuk
-- baris yang link ke Termin (quotation_item_id terisi) -- baris
-- payments manual lama/baru yang tidak link ke Termin tidak kena
-- trigger ini sama sekali.

begin;

-- ========================================================================
-- 1. Kolom baru: link payments ke Termin RAB (case_quotation_items)
-- ========================================================================

alter table public.payments
  add column if not exists quotation_item_id uuid
  references public.case_quotation_items(id) on delete set null;

-- ========================================================================
-- 2. Satu Termin cuma boleh punya 1 invoice aktif
-- ========================================================================

create unique index if not exists payments_quotation_item_id_unique
  on public.payments (quotation_item_id)
  where quotation_item_id is not null;

-- ========================================================================
-- 3. Auto-generate invoice_number, HANYA untuk baris yang link ke
--    Termin (quotation_item_id terisi). Baris payments manual
--    lama/baru yang tidak link ke Termin tidak kena trigger ini sama
--    sekali.
-- ========================================================================

create or replace function public.generate_invoice_number()
returns trigger
language plpgsql
security definer
as $$
declare
  case_number_value text;
  next_seq int;
begin
  if new.quotation_item_id is null then
    return new;
  end if;

  select case_number into case_number_value
  from public.cases
  where id = new.case_id;

  select count(*) + 1 into next_seq
  from public.payments
  where case_id = new.case_id
    and invoice_number is not null;

  new.invoice_number := coalesce(case_number_value, 'SMA-UNKNOWN') || '-INV-' || lpad(next_seq::text, 2, '0');

  return new;
end;
$$;

drop trigger if exists payments_generate_invoice_number on public.payments;

create trigger payments_generate_invoice_number
before insert on public.payments
for each row
execute function public.generate_invoice_number();

commit;
