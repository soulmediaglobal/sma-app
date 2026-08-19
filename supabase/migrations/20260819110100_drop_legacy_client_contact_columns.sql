-- Run only after the frontend that uses pic_* columns has been deployed
-- successfully and the Client List has been verified.

begin;

do $$
begin
  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name in (
        'npwp',
        'nib',
        'business_field',
        'address',
        'pic_name',
        'pic_title',
        'pic_phone',
        'pic_email',
        'director_name',
        'director_phone',
        'director_id_number',
        'referral_source',
        'general_notes'
      )
      and data_type = 'text'
      and is_nullable = 'YES'
  ) <> 13 then
    raise exception 'Required nullable text columns are not available on public.clients';
  end if;
end;
$$;

alter table public.clients
  drop column contact_name,
  drop column contact_phone,
  drop column contact_email;

commit;
