-- Issue #232 — Supervisor setara admin di activities & payments.
-- Gap ditemukan: activities tidak punya policy supervisor sama sekali;
-- payments cuma SELECT+UPDATE, tidak ada INSERT untuk supervisor.

begin;

create policy activities_supervisor_all
on public.activities
for all
using (auth_role() = 'supervisor')
with check (auth_role() = 'supervisor');

drop policy payments_supervisor_select on public.payments;
drop policy payments_supervisor_update on public.payments;

create policy payments_supervisor_all
on public.payments
for all
using (auth_role() = 'supervisor')
with check (auth_role() = 'supervisor');

commit;
