-- Limpieza de politicas antiguas que conservaron nombres historicos.
-- Ejecutar solo si la verificacion muestra las politicas "Admins manage tenant ...".

begin;

drop policy if exists "Admins manage tenant leases" on public.tenant_leases;
drop policy if exists "Tenants read own leases" on public.tenant_leases;
drop policy if exists "Admins manage tenant payments" on public.tenant_payments;
drop policy if exists "Tenants read own payments" on public.tenant_payments;
drop policy if exists "Admins manage tenant notes" on public.tenant_notes;
drop policy if exists "Tenants read visible notes" on public.tenant_notes;

commit;
