-- Reasigna el local NO-20 desde Ximena Paz Bessone a Michelle Cisternas.
-- Ejecutar completo en Supabase SQL Editor con el rol postgres.

begin;

do $$
declare
    v_store_owner uuid;
    v_auth_email text;
    v_old_user constant uuid := '63e5a02b-2524-4f62-960b-fe999919ed55';
    v_new_user constant uuid := 'f06b7d42-8a6a-4d29-a4c1-0d28d05ebd52';
begin
    select lower(email)
    into v_auth_email
    from auth.users
    where id = v_new_user;

    if v_auth_email is null then
        raise exception 'No existe el usuario de Michelle en Authentication: %', v_new_user;
    end if;

    select owner_id
    into v_store_owner
    from public.stores
    where id = 'NO-20'
    for update;

    if not found then
        raise exception 'No existe el local NO-20 en public.stores.';
    end if;

    if v_store_owner is not null
       and v_store_owner <> v_old_user
       and v_store_owner <> v_new_user then
        raise exception 'NO-20 pertenece actualmente a un UID distinto: %', v_store_owner;
    end if;

    if exists (
        select 1
        from public.user_profiles
        where lower(email) = v_auth_email
          and auth_user_id <> v_new_user
    ) then
        raise exception 'El correo de Michelle está vinculado a otro UID en user_profiles.';
    end if;
end $$;

-- Conserva el historial de Ximena, pero cierra cualquier relación vigente.
update public.tenant_leases
set
    status = 'cancelled',
    end_date = coalesce(end_date, current_date),
    ended_at = coalesce(ended_at, now()),
    ended_reason = coalesce(ended_reason, 'La postulante desistió del arriendo de NO-20.'),
    updated_at = now()
where store_id = 'NO-20'
  and tenant_auth_user_id = '63e5a02b-2524-4f62-960b-fe999919ed55'
  and status in ('draft', 'active', 'suspended');

-- Las obligaciones impagas de un arriendo que no se concretó no pasan a Michelle.
update public.tenant_payments
set
    status = 'cancelled',
    notes = concat_ws(' ', nullif(notes, ''), 'Cancelado por desistimiento del arriendo de NO-20.'),
    updated_at = now()
where lease_id in (
    select id
    from public.tenant_leases
    where store_id = 'NO-20'
      and tenant_auth_user_id = '63e5a02b-2524-4f62-960b-fe999919ed55'
      and status = 'cancelled'
)
  and amount_paid = 0
  and status in ('pending', 'late');

-- Las notas anteriores se conservan sólo para la administración.
update public.tenant_notes
set visibility = 'private', updated_at = now()
where store_id = 'NO-20'
  and tenant_auth_user_id = '63e5a02b-2524-4f62-960b-fe999919ed55';

-- NO-20 debe comenzar con un catálogo y conversaciones limpios.
delete from public.store_products
where store_id = 'NO-20' or local_code = 'NO-20';

delete from public.contact_messages
where store_id = 'NO-20';

do $$
begin
    if to_regclass('public.store_bot_leads') is not null then
        execute format('delete from public.store_bot_leads where store_id = %L', 'NO-20');
    end if;
    if to_regclass('public.store_bot_sessions') is not null then
        execute format('delete from public.store_bot_sessions where store_id = %L', 'NO-20');
    end if;
    if to_regclass('public.store_bot_settings') is not null then
        execute format('delete from public.store_bot_settings where store_id = %L', 'NO-20');
    end if;
end $$;

-- Crea o corrige el perfil de aplicación de Michelle.
-- El SQL Editor no expone auth.uid(); se pausa sólo este trigger dentro de la transacción.
alter table public.user_profiles
disable trigger protect_user_profile_security_fields_trigger;

insert into public.user_profiles (
    auth_user_id,
    email,
    display_name,
    role,
    updated_at
)
values (
    'f06b7d42-8a6a-4d29-a4c1-0d28d05ebd52',
    (select lower(email) from auth.users where id = 'f06b7d42-8a6a-4d29-a4c1-0d28d05ebd52'),
    'Michelle Cisternas',
    'tenant',
    now()
)
on conflict (auth_user_id) do update
set
    email = excluded.email,
    display_name = coalesce(nullif(public.user_profiles.display_name, ''), excluded.display_name),
    role = case when public.user_profiles.role = 'admin' then 'admin' else 'tenant' end,
    updated_at = now();

-- Si Michelle postuló mediante el formulario, vincula y aprueba su solicitud.
update public.tenant_applications
set
    applicant_auth_user_id = 'f06b7d42-8a6a-4d29-a4c1-0d28d05ebd52',
    status = 'approved'
where applicant_auth_user_id = 'f06b7d42-8a6a-4d29-a4c1-0d28d05ebd52'
   or lower(email) in (
       (select lower(email) from auth.users where id = 'f06b7d42-8a6a-4d29-a4c1-0d28d05ebd52'),
       'michellecisternas@gmail.com'
   );

-- Asigna NO-20 y elimina datos públicos del ocupante anterior.
update public.stores
set
    owner_id = 'f06b7d42-8a6a-4d29-a4c1-0d28d05ebd52',
    name = 'NO-20',
    category = null,
    contact_email = (
        select lower(email)
        from auth.users
        where id = 'f06b7d42-8a6a-4d29-a4c1-0d28d05ebd52'
    ),
    contact_phone = null,
    whatsapp = null,
    social_url = null,
    address = null,
    maps_url = null,
    logo_url = null,
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
where id = 'NO-20';

-- Ximena deja de ser tenant sólo si no conserva otro local asignado.
update public.user_profiles
set role = 'registered_visitor', updated_at = now()
where auth_user_id = '63e5a02b-2524-4f62-960b-fe999919ed55'
  and role = 'tenant'
  and not exists (
      select 1
      from public.stores
      where owner_id = '63e5a02b-2524-4f62-960b-fe999919ed55'
  );

alter table public.user_profiles
enable trigger protect_user_profile_security_fields_trigger;

commit;

-- Verificación final: debe mostrar el local y el perfil de Michelle.
select 'store' as section, jsonb_build_object(
    'id', s.id,
    'local_code', s.local_code,
    'owner_id', s.owner_id,
    'name', s.name,
    'contact_email', s.contact_email,
    'service_status', s.service_status
) as payload
from public.stores s
where s.id = 'NO-20'

union all

select 'profile' as section, jsonb_build_object(
    'auth_user_id', p.auth_user_id,
    'email', p.email,
    'display_name', p.display_name,
    'role', p.role
) as payload
from public.user_profiles p
where p.auth_user_id = 'f06b7d42-8a6a-4d29-a4c1-0d28d05ebd52';
