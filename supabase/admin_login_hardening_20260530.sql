-- Endurecimiento de administradores y login publico.
-- Ejecutar en Supabase SQL Editor despues de respaldar la base.
--
-- Objetivos:
-- 1. Quitar el privilegio admin basado en un email escrito en codigo.
-- 2. Centralizar administradores en public.admin_members.
-- 3. Evitar que RPCs publicas anonimas revelen correos desde nick, marca o local.

begin;

create table if not exists public.admin_members (
    auth_user_id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

alter table public.admin_members enable row level security;

-- Bootstrap temporal: permite migrar administradores existentes desde user_profiles.
create or replace function public.is_mall_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select auth.uid() is not null and (
        exists (
            select 1
            from public.admin_members am
            where am.auth_user_id = auth.uid()
        )
        or exists (
            select 1
            from public.user_profiles p
            where p.auth_user_id = auth.uid()
              and p.role = 'admin'
        )
    );
$$;

revoke all on function public.is_mall_admin() from public;
grant execute on function public.is_mall_admin() to authenticated;

drop policy if exists "Admins can read admin members" on public.admin_members;
create policy "Admins can read admin members"
on public.admin_members for select
using (public.is_mall_admin() or auth.uid() = auth_user_id);

drop policy if exists "Admins can manage admin members" on public.admin_members;
create policy "Admins can manage admin members"
on public.admin_members for all
using (public.is_mall_admin())
with check (public.is_mall_admin());

insert into public.admin_members (auth_user_id, email)
select p.auth_user_id, p.email
from public.user_profiles p
where p.role = 'admin'
on conflict (auth_user_id) do update
set email = excluded.email;

-- Regla definitiva: admin solo si existe en admin_members.
create or replace function public.is_mall_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select auth.uid() is not null and exists (
        select 1
        from public.admin_members am
        where am.auth_user_id = auth.uid()
    );
$$;

revoke all on function public.is_mall_admin() from public;
grant execute on function public.is_mall_admin() to authenticated;

-- Estos RPCs transforman identificadores publicos en correos. El cliente ya fue
-- ajustado para exigir correo directo; se revoca anon para cerrar enumeracion.
revoke execute on function public.resolve_member_login_email(text) from anon;
revoke execute on function public.resolve_tenant_login_email(text) from anon;
grant execute on function public.resolve_member_login_email(text) to authenticated;
grant execute on function public.resolve_tenant_login_email(text) to authenticated;

commit;
