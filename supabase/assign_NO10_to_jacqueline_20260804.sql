-- Reasigna NO-10 a Jacqueline Morales Escudero / Jaky Mechitas.
-- La cuenta Auth anterior no se elimina; su postulacion se archiva como cancelled.

begin;

-- El SQL Editor no trae JWT. Se establece localmente la identidad del unico
-- administrador para que el trigger de seguridad valide esta transaccion.
select set_config(
    'request.jwt.claim.sub',
    '2545564b-41e4-47f4-93ea-ec22b8b0ee7e',
    true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
    new_owner_id constant uuid := '89f13627-10e8-49f6-8f4f-c839132ca6ff';
    new_owner_email constant text := 'jakymechitas@gmail.com';
    new_application_id constant uuid := '770b8d35-097c-406b-9aaa-fd25c37470b0';
    old_owner_id constant uuid := 'ab6ffc2d-7eb5-4516-886d-8269c501f6ee';
    old_owner_email constant text := 'marior.2307@gmail.com';
    target_store public.stores%rowtype;
    auth_email text;
    target_count integer;
    product_count integer;
    asset_count integer;
    active_lease_count integer;
begin
    select lower(trim(u.email))
    into auth_email
    from auth.users u
    where u.id = new_owner_id;

    if auth_email is null then
        raise exception 'No existe la nueva cuenta Auth de Jacqueline.';
    end if;

    if auth_email <> new_owner_email then
        raise exception 'El UID nuevo pertenece a %, no a %.', auth_email, new_owner_email;
    end if;

    select count(*)
    into target_count
    from public.stores s
    where upper(replace(trim(coalesce(s.local_code, s.id)), '-', '')) = 'NO10';

    if target_count <> 1 then
        raise exception 'NO-10 tiene % coincidencias; se esperaba exactamente una.', target_count;
    end if;

    select s.*
    into target_store
    from public.stores s
    where upper(replace(trim(coalesce(s.local_code, s.id)), '-', '')) = 'NO10'
    limit 1
    for update;

    if target_store.owner_id is distinct from old_owner_id
       and target_store.owner_id is distinct from new_owner_id then
        raise exception 'NO-10 pertenece actualmente al UID %. No se reemplazo.', target_store.owner_id;
    end if;

    select count(*)
    into product_count
    from public.store_products p
    where upper(replace(trim(coalesce(p.local_code, '')), '-', '')) = 'NO10';

    select count(*)
    into asset_count
    from storage.objects o
    where o.bucket_id = 'store-assets'
      and upper(replace((storage.foldername(o.name))[1], '-', '')) = 'NO10';

    select count(*)
    into active_lease_count
    from public.tenant_leases l
    where upper(replace(trim(coalesce(l.local_code, '')), '-', '')) = 'NO10'
      and lower(coalesce(l.status, '')) in ('active', 'draft', 'suspended');

    if product_count > 0 or asset_count > 0 or active_lease_count > 0 then
        raise exception
            'NO-10 cambio desde la revision: productos %, archivos %, contratos activos %. No se modifico.',
            product_count,
            asset_count,
            active_lease_count;
    end if;

    insert into public.user_profiles (
        auth_user_id,
        email,
        display_name,
        role,
        updated_at
    )
    values (
        new_owner_id,
        new_owner_email,
        'Jacqueline Morales Escudero',
        'tenant',
        now()
    )
    on conflict (auth_user_id) do update
    set
        email = excluded.email,
        display_name = excluded.display_name,
        role = case
            when public.user_profiles.role = 'admin' then 'admin'
            else 'tenant'
        end,
        updated_at = now();

    update public.tenant_applications
    set
        brand_name = 'Jaky Mechitas',
        category = 'Pelucas',
        email = new_owner_email,
        applicant_auth_user_id = new_owner_id,
        status = 'approved'
    where id = new_application_id;

    if not found then
        raise exception 'No se encontro la postulacion de Jacqueline.';
    end if;

    update public.tenant_applications
    set status = 'cancelled'
    where id <> new_application_id
      and (
          lower(trim(email)) = new_owner_email
          or applicant_auth_user_id = new_owner_id
      )
      and lower(coalesce(status, '')) in ('pending', 'approved');

    update public.tenant_applications
    set status = 'cancelled'
    where (
          lower(trim(email)) = old_owner_email
          or applicant_auth_user_id = old_owner_id
      )
      and lower(coalesce(status, '')) in ('pending', 'approved');

    update public.stores
    set
        owner_id = new_owner_id,
        slug = null,
        name = 'Jaky Mechitas',
        category = 'Pelucas',
        contact_email = new_owner_email,
        contact_phone = '+56995854448',
        whatsapp = '+56995854448',
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
    where id = target_store.id;
end;
$$;

commit;

select
    s.id,
    s.local_code,
    s.name,
    s.owner_id,
    s.contact_email,
    s.contact_phone,
    s.service_status,
    s.product_tier,
    s.product_limit,
    a.id as application_id,
    a.status as application_status,
    a.applicant_auth_user_id,
    p.role as profile_role
from public.stores s
join public.tenant_applications a
    on a.id = '770b8d35-097c-406b-9aaa-fd25c37470b0'::uuid
left join public.user_profiles p
    on p.auth_user_id = s.owner_id
where upper(replace(trim(coalesce(s.local_code, s.id)), '-', '')) = 'NO10';
