begin;

alter table public.clients
  add column npwp text,
  add column nib text,
  add column business_field text,
  add column address text,
  add column pic_name text,
  add column pic_title text,
  add column pic_phone text,
  add column pic_email text,
  add column director_name text,
  add column director_phone text,
  add column director_id_number text,
  add column referral_source text,
  add column general_notes text;

update public.clients
set
  pic_name = contact_name,
  pic_phone = contact_phone,
  pic_email = contact_email;

do $$
begin
  if exists (
    select 1
    from public.clients
    where pic_name is distinct from contact_name
      or pic_phone is distinct from contact_phone
      or pic_email is distinct from contact_email
  ) then
    raise exception 'Client contact data was not copied completely';
  end if;
end;
$$;

commit;
