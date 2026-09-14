-- Alta segura de Andres Marquez en el local E-106.
-- Ejecutar completo en Supabase > SQL Editor > New query.

begin;

do $$
declare
    requested_auth_user_id constant uuid := '33e5f1b3-a169-4bea-986c-0143486c199d'::uuid;
    requested_email constant text := 'andresamarquez@gmail.com';
    requested_tenant_name constant text := 'Andrés Márquez';
    requested_local_code constant text := 'E-106';
    auth_record record;
    store_record record;
    matching_store_count integer;
    canonical_application_id public.tenant_applications.id%type;
begin
    -- UID y correo deben pertenecer al mismo usuario de Authentication.
    select auth_user.id, auth_user.email
    into auth_record
    from auth.users auth_user
    where auth_user.id = requested_auth_user_id
    limit 1;

    if not found then
        raise exception
            'No existe el UID % para % (%).',
            requested_auth_user_id,
            requested_tenant_name,
            requested_email;
    end if;

    if lower(trim(auth_record.email)) <> lower(trim(requested_email)) then
        raise exception
            'El UID % pertenece a %, no a %.',
            requested_auth_user_id,
            auth_record.email,
            requested_email;
    end if;

    -- Debe existir exactamente un local E-106.
    select count(*)
    into matching_store_count
    from public.stores store
    where upper(replace(trim(coalesce(store.local_code, '')), '-', ''))
            = upper(replace(trim(requested_local_code), '-', ''))
       or upper(replace(trim(coalesce(store.id::text, '')), '-', ''))
            = upper(replace(trim(requested_local_code), '-', ''));

    if matching_store_count <> 1 then
        raise exception
            'El local % tiene % coincidencias; se esperaba exactamente 1.',
            requested_local_code,
            matching_store_count;
    end if;

    select store.*
    into store_record
    from public.stores store
    where upper(replace(trim(coalesce(store.local_code, '')), '-', ''))
            = upper(replace(trim(requested_local_code), '-', ''))
       or upper(replace(trim(coalesce(store.id::text, '')), '-', ''))
            = upper(replace(trim(requested_local_code), '-', ''))
    limit 1;

    if store_record.owner_id is not null
       and store_record.owner_id <> requested_auth_user_id then
        raise exception
            'El local % ya pertenece al UID %. No se reemplazo por %.',
            requested_local_code,
            store_record.owner_id,
            requested_auth_user_id;
    end if;

    -- Reutiliza una postulacion previa si existiera.
    canonical_application_id := null;

    select application.id
    into canonical_application_id
    from public.tenant_applications application
    where lower(trim(application.email)) = lower(trim(requested_email))
       or application.applicant_auth_user_id = requested_auth_user_id
    order by
        case lower(coalesce(application.status, ''))
            when 'approved' then 0
            when 'pending' then 1
            else 2
        end,
        application.created_at desc nulls last,
        application.id::text desc
    limit 1;

    if canonical_application_id is null then
        insert into public.tenant_applications (
            brand_name,
            category,
            email,
            phone,
            social_link,
            applicant_auth_user_id,
            status
        )
        values (
            requested_tenant_name,
            'Por definir',
            requested_email,
            'PENDIENTE',
            null,
            requested_auth_user_id,
            'approved'
        )
        returning id into canonical_application_id;
    else
        update public.tenant_applications application
        set
            brand_name = requested_tenant_name,
            category = coalesce(nullif(trim(application.category), ''), 'Por definir'),
            email = requested_email,
            phone = coalesce(nullif(trim(application.phone), ''), 'PENDIENTE'),
            applicant_auth_user_id = requested_auth_user_id,
            status = 'approved'
        where application.id = canonical_application_id;
    end if;

    -- Cancela duplicados activos sin borrar historial.
    update public.tenant_applications application
    set status = 'cancelled'
    where application.id <> canonical_application_id
      and (
            lower(trim(application.email)) = lower(trim(requested_email))
            or application.applicant_auth_user_id = requested_auth_user_id
      )
      and lower(coalesce(application.status, '')) in ('pending', 'approved');

    -- Asigna E-106. En una primera asignacion elimina datos visuales,
    -- contacto y Telegram que pudieran pertenecer a un ocupante anterior.
    update public.stores store
    set
        owner_id = requested_auth_user_id,
        name = requested_tenant_name,
        category = case
            when store.owner_id is null then 'Por definir'
            else coalesce(nullif(trim(store.category), ''), 'Por definir')
        end,
        contact_email = requested_email,
        contact_phone = case when store.owner_id is null then null else store.contact_phone end,
        whatsapp = case when store.owner_id is null then null else store.whatsapp end,
        logo_url = case when store.owner_id is null then null else store.logo_url end,
        telegram_notifications_enabled = case
            when store.owner_id is null then false
            else store.telegram_notifications_enabled
        end,
        telegram_chat_id = case when store.owner_id is null then null else store.telegram_chat_id end,
        telegram_chat_username = case when store.owner_id is null then null else store.telegram_chat_username end,
        telegram_link_code = case when store.owner_id is null then null else store.telegram_link_code end,
        telegram_verified_at = case when store.owner_id is null then null else store.telegram_verified_at end,
        service_status = 'active',
        service_status_note = null,
        service_suspended_at = null,
        updated_at = now()
    where store.id = store_record.id;
end;
$$;

commit;

-- Verificacion final: debe devolver AUTH OK, APPROVED y los UID iguales.
select
    'Andrés Márquez' as locatario,
    'E-106' as local_solicitado,
    auth_user.email,
    auth_user.id as auth_uid,
    case
        when auth_user.id = '33e5f1b3-a169-4bea-986c-0143486c199d'::uuid
         and lower(auth_user.email) = 'andresamarquez@gmail.com'
        then 'AUTH OK'
        else 'REVISAR AUTH'
    end as auth_estado,
    store.id as store_id,
    store.local_code,
    store.owner_id,
    store.name as nombre_inicial_local,
    store.category,
    store.contact_email,
    store.service_status,
    application.id::text as application_id,
    application.status as application_status
from auth.users auth_user
left join public.stores store
  on (
        upper(replace(trim(coalesce(store.local_code, '')), '-', '')) = 'E106'
        or upper(replace(trim(coalesce(store.id::text, '')), '-', '')) = 'E106'
  )
left join lateral (
    select application_row.id, application_row.status
    from public.tenant_applications application_row
    where lower(trim(application_row.email)) = 'andresamarquez@gmail.com'
       or application_row.applicant_auth_user_id = '33e5f1b3-a169-4bea-986c-0143486c199d'::uuid
    order by
        case lower(coalesce(application_row.status, ''))
            when 'approved' then 0
            when 'pending' then 1
            else 2
        end,
        application_row.created_at desc nulls last
    limit 1
) application on true
where auth_user.id = '33e5f1b3-a169-4bea-986c-0143486c199d'::uuid;
