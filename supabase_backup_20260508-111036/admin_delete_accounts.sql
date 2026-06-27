-- Ejecuta esto en el SQL Editor del proyecto Supabase actual.
-- Permite que un administrador del mall elimine cuentas desde el panel:
-- - libera locales asignados
-- - borra postulación(es) asociadas
-- - borra user_profiles y mall_members
-- - borra también el usuario en auth.users cuando existe

create or replace function public.delete_mall_account(
    target_auth_user_id uuid default null,
    target_email text default null
)
returns table (
    released_stores integer,
    deleted_applications integer,
    deleted_profiles integer,
    deleted_members integer,
    deleted_auth_users integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    normalized_email text := nullif(lower(trim(coalesce(target_email, ''))), '');
    resolved_auth_user_id uuid := target_auth_user_id;
begin
    if not public.is_mall_admin() then
        raise exception 'Solo los administradores pueden eliminar cuentas.';
    end if;

    if resolved_auth_user_id is null and normalized_email is null then
        raise exception 'Debes indicar un auth_user_id o un email.';
    end if;

    if resolved_auth_user_id is null and normalized_email is not null then
        select up.auth_user_id
        into resolved_auth_user_id
        from public.user_profiles up
        where lower(up.email) = normalized_email
        limit 1;

        if resolved_auth_user_id is null then
            select mm.auth_user_id
            into resolved_auth_user_id
            from public.mall_members mm
            where lower(mm.email) = normalized_email
            limit 1;
        end if;
    end if;

    if normalized_email is null and resolved_auth_user_id is not null then
        select lower(coalesce(up.email, mm.email, au.email))
        into normalized_email
        from auth.users au
        left join public.user_profiles up on up.auth_user_id = au.id
        left join public.mall_members mm on mm.auth_user_id = au.id
        where au.id = resolved_auth_user_id
        limit 1;
    end if;

    if normalized_email = 'alanmauri4815@gmail.com'
        or exists (
            select 1
            from public.user_profiles up
            where (
                (resolved_auth_user_id is not null and up.auth_user_id = resolved_auth_user_id)
                or (normalized_email is not null and lower(up.email) = normalized_email)
            )
            and up.role = 'admin'
        ) then
        raise exception 'No puedes eliminar una cuenta administradora desde este panel.';
    end if;

    update public.stores
    set owner_id = null,
        updated_at = now()
    where resolved_auth_user_id is not null
      and owner_id = resolved_auth_user_id;
    get diagnostics released_stores = row_count;

    delete from public.tenant_applications
    where (normalized_email is not null and lower(email) = normalized_email)
       or (resolved_auth_user_id is not null and applicant_auth_user_id = resolved_auth_user_id);
    get diagnostics deleted_applications = row_count;

    delete from public.user_profiles
    where (resolved_auth_user_id is not null and auth_user_id = resolved_auth_user_id)
       or (normalized_email is not null and lower(email) = normalized_email);
    get diagnostics deleted_profiles = row_count;

    delete from public.mall_members
    where (resolved_auth_user_id is not null and auth_user_id = resolved_auth_user_id)
       or (normalized_email is not null and lower(email) = normalized_email);
    get diagnostics deleted_members = row_count;

    if resolved_auth_user_id is not null then
        delete from auth.users
        where id = resolved_auth_user_id;
        get diagnostics deleted_auth_users = row_count;
    else
        deleted_auth_users := 0;
    end if;

    return query
    select
        released_stores,
        deleted_applications,
        deleted_profiles,
        deleted_members,
        deleted_auth_users;
end;
$$;

revoke all on function public.delete_mall_account(uuid, text) from public;
grant execute on function public.delete_mall_account(uuid, text) to authenticated;
