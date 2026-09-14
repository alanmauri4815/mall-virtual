-- Alta segura de cinco locatarias sin postulacion previa - version 2.
-- Ejecutar el archivo completo en Supabase > SQL Editor > New query.
-- No usa tablas temporales.

begin;

do $$
declare
    source_row record;
    auth_record record;
    store_record record;
    matching_store_count integer;
    canonical_application_id public.tenant_applications.id%type;
begin
    for source_row in
        select *
        from (
            values
                (
                    '12f3fdc2-0a5a-46be-a15d-57802bd4eb83'::uuid,
                    'ak.andreakarin@gmail.com'::text,
                    'Andrea Gutiérrez'::text,
                    'O-106'::text
                ),
                (
                    '22977809-f461-4511-a449-178324bc0ca8'::uuid,
                    'andrearatton77@gmail.com'::text,
                    'Andrea Ratton'::text,
                    'S-101'::text
                ),
                (
                    'b79e9609-dcaf-4035-a537-d9817db296e7'::uuid,
                    'colinaluisa8@gmail.com'::text,
                    'Luisa Colina'::text,
                    'S-104'::text
                ),
                (
                    '10debfb3-a326-4c85-9f7a-9b01408cf7d5'::uuid,
                    'anghieashline.1095@gmail.com'::text,
                    'Anghie Quiñones'::text,
                    'O-105'::text
                ),
                (
                    '5ccfb921-65b4-42a6-a119-cf755350376a'::uuid,
                    'saracruzcomunicaciones@gmail.com'::text,
                    'Sara Cruz'::text,
                    'S-106'::text
                )
        ) as source(auth_user_id, email, tenant_name, local_code)
    loop
        -- El UID y el correo deben corresponder al mismo usuario Auth.
        select auth_user.id, auth_user.email
        into auth_record
        from auth.users auth_user
        where auth_user.id = source_row.auth_user_id
        limit 1;

        if not found then
            raise exception
                'No existe el UID % para % (%).',
                source_row.auth_user_id,
                source_row.tenant_name,
                source_row.email;
        end if;

        if lower(trim(auth_record.email)) <> lower(trim(source_row.email)) then
            raise exception
                'El UID % pertenece a %, no a %.',
                source_row.auth_user_id,
                auth_record.email,
                source_row.email;
        end if;

        -- Debe existir exactamente un local con el codigo solicitado.
        select count(*)
        into matching_store_count
        from public.stores store
        where upper(replace(trim(coalesce(store.local_code, '')), '-', ''))
                = upper(replace(trim(source_row.local_code), '-', ''))
           or upper(replace(trim(coalesce(store.id::text, '')), '-', ''))
                = upper(replace(trim(source_row.local_code), '-', ''));

        if matching_store_count <> 1 then
            raise exception
                'El local % para % tiene % coincidencias; se esperaba exactamente 1.',
                source_row.local_code,
                source_row.tenant_name,
                matching_store_count;
        end if;

        select store.*
        into store_record
        from public.stores store
        where upper(replace(trim(coalesce(store.local_code, '')), '-', ''))
                = upper(replace(trim(source_row.local_code), '-', ''))
           or upper(replace(trim(coalesce(store.id::text, '')), '-', ''))
                = upper(replace(trim(source_row.local_code), '-', ''))
        limit 1;

        if store_record.owner_id is not null
           and store_record.owner_id <> source_row.auth_user_id then
            raise exception
                'El local % ya pertenece al UID %. No se reemplazo por %.',
                source_row.local_code,
                store_record.owner_id,
                source_row.auth_user_id;
        end if;

        -- Reutiliza la postulacion mas pertinente si ya existe.
        canonical_application_id := null;

        select application.id
        into canonical_application_id
        from public.tenant_applications application
        where lower(trim(application.email)) = lower(trim(source_row.email))
           or application.applicant_auth_user_id = source_row.auth_user_id
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
                source_row.tenant_name,
                'Por definir',
                source_row.email,
                'PENDIENTE',
                null,
                source_row.auth_user_id,
                'approved'
            )
            returning id into canonical_application_id;
        else
            update public.tenant_applications application
            set
                brand_name = source_row.tenant_name,
                category = coalesce(nullif(trim(application.category), ''), 'Por definir'),
                email = source_row.email,
                phone = coalesce(nullif(trim(application.phone), ''), 'PENDIENTE'),
                applicant_auth_user_id = source_row.auth_user_id,
                status = 'approved'
            where application.id = canonical_application_id;
        end if;

        -- Oculta duplicados activos sin borrar el historial.
        update public.tenant_applications application
        set status = 'cancelled'
        where application.id <> canonical_application_id
          and (
                lower(trim(application.email)) = lower(trim(source_row.email))
                or application.applicant_auth_user_id = source_row.auth_user_id
          )
          and lower(coalesce(application.status, '')) in ('pending', 'approved');

        -- Vincula el local. En una primera asignacion limpia datos de contacto,
        -- logo y Telegram que pudieran haber quedado de un ocupante anterior.
        update public.stores store
        set
            owner_id = source_row.auth_user_id,
            name = source_row.tenant_name,
            category = case
                when store.owner_id is null then 'Por definir'
                else coalesce(nullif(trim(store.category), ''), 'Por definir')
            end,
            contact_email = source_row.email,
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
    end loop;
end;
$$;

commit;

-- Verificacion final. Debe devolver cinco filas con AUTH OK, APPROVED
-- y owner_id igual a auth_uid.
with source(auth_user_id, email, tenant_name, local_code) as (
    values
        ('12f3fdc2-0a5a-46be-a15d-57802bd4eb83'::uuid, 'ak.andreakarin@gmail.com', 'Andrea Gutiérrez', 'O-106'),
        ('22977809-f461-4511-a449-178324bc0ca8'::uuid, 'andrearatton77@gmail.com', 'Andrea Ratton', 'S-101'),
        ('b79e9609-dcaf-4035-a537-d9817db296e7'::uuid, 'colinaluisa8@gmail.com', 'Luisa Colina', 'S-104'),
        ('10debfb3-a326-4c85-9f7a-9b01408cf7d5'::uuid, 'anghieashline.1095@gmail.com', 'Anghie Quiñones', 'O-105'),
        ('5ccfb921-65b4-42a6-a119-cf755350376a'::uuid, 'saracruzcomunicaciones@gmail.com', 'Sara Cruz', 'S-106')
)
select
    source.tenant_name as locataria,
    source.local_code as local_solicitado,
    source.email,
    auth_user.id as auth_uid,
    case
        when auth_user.id = source.auth_user_id
         and lower(auth_user.email) = lower(source.email)
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
from source
left join auth.users auth_user
  on auth_user.id = source.auth_user_id
left join public.stores store
  on upper(replace(trim(coalesce(store.local_code, '')), '-', ''))
        = upper(replace(trim(source.local_code), '-', ''))
  or upper(replace(trim(coalesce(store.id::text, '')), '-', ''))
        = upper(replace(trim(source.local_code), '-', ''))
left join lateral (
    select application_row.id, application_row.status
    from public.tenant_applications application_row
    where lower(trim(application_row.email)) = lower(trim(source.email))
       or application_row.applicant_auth_user_id = source.auth_user_id
    order by
        case lower(coalesce(application_row.status, ''))
            when 'approved' then 0
            when 'pending' then 1
            else 2
        end,
        application_row.created_at desc nulls last
    limit 1
) application on true
order by source.local_code;
