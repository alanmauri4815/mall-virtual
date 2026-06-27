-- Ajusta estos valores si quieres diagnosticar otro local o usuario.
with params as (
    select
        'SE-10'::text as target_code,
        'admin@example.com'::text as target_email
),
store_match as (
    select
        s.id,
        s.local_code,
        s.owner_id,
        s.contact_email,
        s.name,
        s.service_status
    from public.stores s
    cross join params p
    where s.id = p.target_code
       or s.local_code = p.target_code
),
auth_match as (
    select
        au.id as auth_user_id,
        au.email
    from auth.users au
    cross join params p
    where lower(au.email) = lower(p.target_email)
),
profile_match as (
    select
        up.auth_user_id,
        up.email,
        up.role
    from public.user_profiles up
    cross join params p
    where lower(up.email) = lower(p.target_email)
),
storage_rows as (
    select
        bucket_id,
        name,
        owner,
        created_at,
        updated_at
    from storage.objects so
    cross join params p
    where so.bucket_id = 'store-assets'
      and (
          split_part(so.name, '/', 1) = p.target_code
          or so.name ilike p.target_code || '/logo-%'
      )
)
select 'store_match' as section, row_to_json(store_match)::text as payload
from store_match
union all
select 'auth_match', row_to_json(auth_match)::text
from auth_match
union all
select 'profile_match', row_to_json(profile_match)::text
from profile_match
union all
select 'storage_rows', row_to_json(storage_rows)::text
from storage_rows;

-- Verificación resumida:
-- 1. Si store_match.owner_id = auth_match.auth_user_id, el dueño coincide.
-- 2. Si store_match.contact_email = target_email, la vía de compatibilidad por email coincide.
-- 3. Si profile_match.role = admin, public.is_mall_admin() debería devolver true.
