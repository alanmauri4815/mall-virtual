-- Transfiere SE-10 a Sara Cruz sin modificar la cuenta ni el rol del administrador.
-- Ejecutar completo en Supabase > SQL Editor.

begin;

do $$
declare
    target_user_id constant uuid := '5ccfb921-65b4-42a6-a119-cf755350376a';
    target_email constant text := 'saracruzcomunicaciones@gmail.com';
    auth_email text;
    target_store_id text;
begin
    select lower(trim(u.email))
    into auth_email
    from auth.users u
    where u.id = target_user_id;

    if auth_email is null then
        raise exception 'No existe el UID de Sara Cruz en auth.users.';
    end if;

    if auth_email <> target_email then
        raise exception 'El UID indicado pertenece a %, no a %.', auth_email, target_email;
    end if;

    select s.id
    into target_store_id
    from public.stores s
    where upper(replace(coalesce(s.local_code, s.id), '-', '')) = 'SE10'
       or upper(replace(s.id, '-', '')) = 'SE10'
    order by case when upper(replace(coalesce(s.local_code, ''), '-', '')) = 'SE10' then 0 else 1 end
    limit 1
    for update;

    if target_store_id is null then
        raise exception 'No se encontro el local SE-10 en public.stores.';
    end if;

    update public.stores
    set
        owner_id = target_user_id,
        contact_email = target_email,
        service_status = 'active',
        service_status_note = null,
        service_suspended_at = null,
        updated_at = now()
    where id = target_store_id;
end;
$$;

commit;

-- Resultado esperado: una fila SE-10 con el UID y correo de Sara Cruz.
select
    s.id,
    s.local_code,
    s.name,
    s.owner_id,
    s.contact_email,
    s.service_status,
    u.email as auth_email
from public.stores s
left join auth.users u on u.id = s.owner_id
where upper(replace(coalesce(s.local_code, s.id), '-', '')) = 'SE10'
   or upper(replace(s.id, '-', '')) = 'SE10';
