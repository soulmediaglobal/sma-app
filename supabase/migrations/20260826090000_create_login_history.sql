-- Issue #125 — Session tracking lengkap.
-- Tabel baru login_history: 1 baris per login berhasil, biar riwayat
-- kebentuk otomatis (bukan cuma "login terakhir" seperti sekarang).

begin;

create table public.login_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_type text check (device_type in ('mobile', 'desktop')),
  device_brand text,
  os text,
  browser text,
  ip_address text,
  city text,
  country text,
  logged_in_at timestamptz not null default now()
);

create index login_history_profile_id_idx on public.login_history(profile_id, logged_in_at desc);

alter table public.login_history enable row level security;

-- User cuma bisa insert & lihat baris miliknya sendiri (dicatat saat
-- dia login), admin bisa lihat semua (buat audit keamanan).
create policy login_history_own_insert
  on public.login_history
  for insert
  with check (profile_id = auth.uid());

create policy login_history_own_select
  on public.login_history
  for select
  using (profile_id = auth.uid());

create policy login_history_admin_select
  on public.login_history
  for select
  using (public.auth_role() = 'admin');

commit;
