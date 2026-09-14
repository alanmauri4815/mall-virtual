-- Helper seguro para asignar manualmente duenos de locales.
-- Mantiene la restriccion owner_id -> auth.users(id), para evitar UID invalidos.
-- Ejecutar una sola vez en Supabase SQL Editor.

create or replace function public.admin_assign_store_owner(
    p_local_code text,
    p_owner_email text default null,
    p_owner_id uuid default null,
    p_store_name text default null,
    p_contact_phone text default null
)
returns table (
    store_id text,
    local_code text,
    owner_id uuid,
    contact_email text,
    service_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_owner_id uuid;
    v_owner_email text;
begin
    if not public.is_mall_admin() then
        raise exception 'Solo administradores del mall pueden asignar owner_id.';
    end if;

    if nullif(trim(p_local_code), '') is null then
        raise exception 'Debes indicar p_local_code.';
    end if;

    if p_owner_id is not null then
        select au.id, au.email
        into v_owner_id, v_owner_email
        from auth.users au
        where au.id = p_owner_id
        limit 1;
    elsif nullif(trim(p_owner_email), '') is not null then
        select au.id, au.email
        into v_owner_id, v_owner_email
        from auth.users au
        where lower(au.email) = lower(trim(p_owner_email))
        limit 1;
    else
        raise exception 'Debes indicar p_owner_email o p_owner_id.';
    end if;

    if v_owner_id is null then
        raise exception 'No existe un usuario Auth para ese correo/UID. Primero crealo en Authentication > Users.';
    end if;

    return query
    update public.stores s
    set
        owner_id = v_owner_id,
        contact_email = coalesce(v_owner_email, lower(trim(p_owner_email)), s.contact_email),
        contact_phone = coalesce(nullif(trim(p_contact_phone), ''), s.contact_phone),
        whatsapp = coalesce(nullif(trim(p_contact_phone), ''), s.whatsapp),
        name = coalesce(nullif(trim(p_store_name), ''), s.name),
        service_status = 'active',
        service_status_note = null,
        updated_at = now()
    where upper(replace(s.local_code, '-', '')) = upper(replace(trim(p_local_code), '-', ''))
       or upper(replace(s.id::text, '-', '')) = upper(replace(trim(p_local_code), '-', ''))
    returning s.id, s.local_code, s.owner_id, s.contact_email, s.service_status;
end;
$$;

revoke all on function public.admin_assign_store_owner(text, text, uuid, text, text) from public;
grant execute on function public.admin_assign_store_owner(text, text, uuid, text, text) to authenticated;

-- Ejemplos de uso:
--
-- Asignar por correo:
-- select * from public.admin_assign_store_owner(
--   p_local_code := 'E-107',
--   p_owner_email := 'ximenaporras@gmail.com',
--   p_store_name := 'Ximena Porras Salomon',
--   p_contact_phone := '995203692'
-- );
--
-- Asignar por UID:
-- select * from public.admin_assign_store_owner(
--   p_local_code := 'E-107',
--   p_owner_id := '3283cbdd-f4a9-4acd-a1a0-e4c4544417d2',
--   p_store_name := 'Ximena Porras Salomon',
--   p_contact_phone := '995203692'
-- );
