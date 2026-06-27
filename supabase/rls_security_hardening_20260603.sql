-- Incremental Supabase/RLS hardening.
-- Ejecutar despues de mall_current_setup.sql y admin_login_hardening_20260530.sql.
--
-- Objetivos:
-- 1. Cerrar RPCs obsoletas que resolvian correos por nickname/marca/local.
-- 2. Asegurar permisos SQL necesarios para las operaciones admin que ya limita RLS.
-- 3. Reafirmar RLS en tablas con datos comerciales sensibles.

begin;

-- Estas funciones fueron utiles para login por alias, pero exponen correos a cualquier
-- usuario autenticado si quedan ejecutables. El frontend actual ya usa email directo.
do $$
begin
    if to_regprocedure('public.resolve_member_login_email(text)') is not null then
        revoke all on function public.resolve_member_login_email(text) from public;
        revoke execute on function public.resolve_member_login_email(text) from anon;
        revoke execute on function public.resolve_member_login_email(text) from authenticated;
    end if;

    if to_regprocedure('public.resolve_tenant_login_email(text)') is not null then
        revoke all on function public.resolve_tenant_login_email(text) from public;
        revoke execute on function public.resolve_tenant_login_email(text) from anon;
        revoke execute on function public.resolve_tenant_login_email(text) from authenticated;
    end if;
end $$;

-- RLS debe permanecer activo en todas las tablas sensibles expuestas por PostgREST.
alter table if exists public.user_profiles enable row level security;
alter table if exists public.admin_members enable row level security;
alter table if exists public.mall_members enable row level security;
alter table if exists public.tenant_applications enable row level security;
alter table if exists public.stores enable row level security;
alter table if exists public.store_products enable row level security;
alter table if exists public.contact_messages enable row level security;
alter table if exists public.mall_messages enable row level security;
alter table if exists public.store_rent_rates enable row level security;
alter table if exists public.tenant_leases enable row level security;
alter table if exists public.tenant_payments enable row level security;
alter table if exists public.tenant_notes enable row level security;

-- Permisos SQL minimos para operaciones del panel admin.
-- Las politicas RLS existentes siguen restringiendo estas escrituras a public.is_mall_admin().
grant select on public.store_rent_rates, public.tenant_leases, public.tenant_payments, public.tenant_notes
to authenticated;

grant insert, update on public.store_rent_rates, public.tenant_leases, public.tenant_payments, public.tenant_notes
to authenticated;

-- La funcion de borrado masivo sigue expuesta solo a usuarios autenticados, pero valida
-- internamente public.is_mall_admin() antes de tocar datos o auth.users.
do $$
begin
    if to_regprocedure('public.delete_mall_account(uuid,text)') is not null then
        revoke all on function public.delete_mall_account(uuid, text) from public;
        revoke execute on function public.delete_mall_account(uuid, text) from anon;
        grant execute on function public.delete_mall_account(uuid, text) to authenticated;
    end if;
end $$;

commit;

-- Verificacion sugerida despues de aplicar:
-- select routine_name, routine_type
-- from information_schema.routines
-- where specific_schema = 'public'
--   and routine_name in ('resolve_member_login_email', 'resolve_tenant_login_email', 'delete_mall_account');
--
-- select grantee, privilege_type
-- from information_schema.routine_privileges
-- where specific_schema = 'public'
--   and routine_name in ('resolve_member_login_email', 'resolve_tenant_login_email', 'delete_mall_account')
-- order by routine_name, grantee, privilege_type;
--
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and grantee = 'authenticated'
--   and table_name in ('store_rent_rates', 'tenant_leases', 'tenant_payments', 'tenant_notes')
-- order by table_name, privilege_type;
