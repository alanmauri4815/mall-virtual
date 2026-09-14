-- Corrige la asignacion de Anghie Quinones: O-105 -> O-205.
-- Conserva la configuracion comercial y mueve el catalogo.
-- No modifica Authentication, user_profiles ni privilegios de administrador.

begin;

do $$
declare
    tenant_user_id constant uuid := '10debfb3-a326-4c85-9f7a-9b01408cf7d5';
    tenant_email constant text := 'anghieashline.1095@gmail.com';
    source_code constant text := 'O-105';
    target_code constant text := 'O-205';
    auth_email text;
    source_store public.stores%rowtype;
    target_store public.stores%rowtype;
    source_match_count integer;
    target_match_count integer;
    source_product_count integer;
    target_product_count integer;
begin
    select lower(trim(u.email))
    into auth_email
    from auth.users u
    where u.id = tenant_user_id;

    if auth_email is null then
        raise exception 'No existe el UID de Anghie en auth.users.';
    end if;

    if auth_email <> tenant_email then
        raise exception 'El UID indicado pertenece a %, no a %.', auth_email, tenant_email;
    end if;

    select count(*)
    into source_match_count
    from public.stores s
    where upper(replace(trim(coalesce(s.local_code, '')), '-', '')) = 'O105'
       or upper(replace(trim(coalesce(s.id, '')), '-', '')) = 'O105';

    select count(*)
    into target_match_count
    from public.stores s
    where upper(replace(trim(coalesce(s.local_code, '')), '-', '')) = 'O205'
       or upper(replace(trim(coalesce(s.id, '')), '-', '')) = 'O205';

    if source_match_count <> 1 then
        raise exception 'O-105 tiene % coincidencias; se esperaba exactamente una.', source_match_count;
    end if;

    if target_match_count <> 1 then
        raise exception 'O-205 tiene % coincidencias; se esperaba exactamente una.', target_match_count;
    end if;

    select s.*
    into source_store
    from public.stores s
    where upper(replace(trim(coalesce(s.local_code, '')), '-', '')) = 'O105'
       or upper(replace(trim(coalesce(s.id, '')), '-', '')) = 'O105'
    limit 1
    for update;

    select s.*
    into target_store
    from public.stores s
    where upper(replace(trim(coalesce(s.local_code, '')), '-', '')) = 'O205'
       or upper(replace(trim(coalesce(s.id, '')), '-', '')) = 'O205'
    limit 1
    for update;

    if source_store.owner_id is null
       and target_store.owner_id = tenant_user_id then
        raise notice 'La correccion ya estaba aplicada.';
        return;
    end if;

    if source_store.owner_id is distinct from tenant_user_id then
        raise exception 'O-105 pertenece al UID %, no a Anghie.', source_store.owner_id;
    end if;

    if target_store.owner_id is not null
       and target_store.owner_id <> tenant_user_id then
        raise exception 'O-205 ya pertenece al UID %. No se reemplazo.', target_store.owner_id;
    end if;

    if target_store.owner_id is null
       and nullif(trim(coalesce(target_store.contact_email, '')), '') is not null
       and lower(trim(target_store.contact_email)) <> tenant_email then
        raise exception
            'O-205 esta reservado para %. No se reemplazo la reserva.',
            target_store.contact_email;
    end if;

    select count(*)
    into source_product_count
    from public.store_products p
    where upper(replace(trim(coalesce(p.local_code, '')), '-', '')) = 'O105';

    select count(*)
    into target_product_count
    from public.store_products p
    where upper(replace(trim(coalesce(p.local_code, '')), '-', '')) = 'O205';

    if target_product_count > 0 then
        raise exception 'O-205 ya contiene % productos. No se mezclaron catalogos.', target_product_count;
    end if;

    if source_product_count > coalesce(target_store.product_limit, 10) then
        raise exception
            'O-105 tiene % productos y O-205 permite %. Reduce el catalogo antes de moverlo.',
            source_product_count,
            coalesce(target_store.product_limit, 10);
    end if;

    -- Libera primero los valores unicos del local antiguo, especialmente slug.
    update public.stores
    set
        owner_id = null,
        slug = null,
        name = coalesce(nullif(trim(source_store.local_code), ''), source_store.id),
        category = null,
        contact_email = null,
        contact_phone = null,
        whatsapp = null,
        logo_url = null,
        shelf_style = 'madera',
        primary_color = '#c9a66b',
        checkout_mode = 'whatsapp',
        telegram_notifications_enabled = false,
        telegram_chat_id = null,
        telegram_chat_username = null,
        telegram_link_code = null,
        telegram_verified_at = null,
        service_status = 'active',
        service_status_note = null,
        service_suspended_at = null,
        updated_at = now()
    where id = source_store.id;

    update public.stores
    set
        owner_id = tenant_user_id,
        slug = source_store.slug,
        name = coalesce(nullif(trim(source_store.name), ''), 'Anghie Quinones'),
        category = source_store.category,
        contact_email = tenant_email,
        contact_phone = source_store.contact_phone,
        whatsapp = source_store.whatsapp,
        logo_url = source_store.logo_url,
        shelf_style = coalesce(source_store.shelf_style, target_store.shelf_style, 'madera'),
        primary_color = coalesce(source_store.primary_color, target_store.primary_color, '#c9a66b'),
        checkout_mode = coalesce(source_store.checkout_mode, target_store.checkout_mode, 'whatsapp'),
        telegram_notifications_enabled = coalesce(source_store.telegram_notifications_enabled, false),
        telegram_chat_id = source_store.telegram_chat_id,
        telegram_chat_username = source_store.telegram_chat_username,
        telegram_link_code = source_store.telegram_link_code,
        telegram_verified_at = source_store.telegram_verified_at,
        service_status = 'active',
        service_status_note = null,
        service_suspended_at = null,
        updated_at = now()
    where id = target_store.id;

    update public.store_products
    set local_code = target_store.local_code
    where upper(replace(trim(coalesce(local_code, '')), '-', '')) = 'O105';

    -- Algunas instalaciones antiguas conservan tambien store_id en productos.
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'store_products'
          and column_name = 'store_id'
    ) then
        execute
            'update public.store_products set store_id = $1 where upper(replace(trim(coalesce(store_id::text, '''')), ''-'', '''')) = ''O105'''
        using target_store.id;
    end if;
end;
$$;

commit;

-- Verificacion final: O-105 libre y O-205 asignado a Anghie.
select
    s.id,
    s.local_code,
    s.name,
    s.owner_id,
    s.contact_email,
    s.product_tier,
    s.product_limit,
    count(p.id) as products
from public.stores s
left join public.store_products p
    on upper(replace(trim(coalesce(p.local_code, '')), '-', ''))
       = upper(replace(trim(coalesce(s.local_code, '')), '-', ''))
where upper(replace(trim(coalesce(s.local_code, s.id)), '-', '')) in ('O105', 'O205')
group by
    s.id,
    s.local_code,
    s.name,
    s.owner_id,
    s.contact_email,
    s.product_tier,
    s.product_limit
order by s.local_code;

-- Si este valor es mayor que cero, las imagenes siguen visibles pero quedaron
-- bajo la carpeta antigua. Informalo para preparar una migracion de Storage.
select count(*) as assets_in_old_O105_folder
from storage.objects o
where o.bucket_id = 'store-assets'
  and upper(replace((storage.foldername(o.name))[1], '-', '')) = 'O105';
