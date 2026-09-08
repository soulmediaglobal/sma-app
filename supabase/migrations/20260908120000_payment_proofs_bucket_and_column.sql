-- Issue #224 — Upload & Verifikasi Bukti Transfer oleh Admin

begin;

alter table public.payments
  add column proof_storage_path text;

do $$
begin
  if exists (
    select 1
    from storage.buckets
    where id = 'payment-proofs'
       or name = 'payment-proofs'
  ) then
    raise exception 'Storage bucket payment-proofs sudah ada; konfigurasi existing tidak ditimpa';
  end if;
end;
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
);

commit;
