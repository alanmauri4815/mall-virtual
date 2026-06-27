-- Ejecuta esto en el SQL Editor del proyecto Supabase actual.
-- Está adaptado al esquema real detectado:
-- - stores usa id como código del local
-- - tenant_applications usa id UUID y no tenía applicant_auth_user_id
-- - user_profiles aún no existe

create table if not exists public.user_profiles (
    auth_user_id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    display_name text,
    role text not null default 'registered_visitor'
        check (role in ('registered_visitor', 'tenant', 'admin')),
    last_pos jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists last_pos jsonb;

alter table public.user_profiles enable row level security;

drop policy if exists "Users can read own app profile" on public.user_profiles;
create policy "Users can read own app profile"
on public.user_profiles for select
using (auth.uid() = auth_user_id);

drop policy if exists "Users can insert own app profile" on public.user_profiles;
create policy "Users can insert own app profile"
on public.user_profiles for insert
with check (auth.uid() = auth_user_id and role = 'registered_visitor');

drop policy if exists "Users can update own basic app profile" on public.user_profiles;
create policy "Users can update own basic app profile"
on public.user_profiles for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id and role = 'registered_visitor');

create or replace function public.is_mall_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.user_profiles p
        where p.auth_user_id = auth.uid()
        and p.role = 'admin'
    );
$$;

revoke all on function public.is_mall_admin() from public;
grant execute on function public.is_mall_admin() to authenticated;

create or replace function public.resolve_tenant_login_email(login_identifier text)
returns text
language sql
security definer
set search_path = public
as $$
    with clean as (
        select lower(trim(login_identifier)) as value
    )
    select resolved.email
    from (
        select ta.email, 1 as priority
        from public.tenant_applications ta
        cross join clean
        where lower(trim(ta.brand_name)) = clean.value

        union all

        select s.contact_email as email, 2 as priority
        from public.stores s
        cross join clean
        where s.contact_email is not null
          and (
              lower(trim(coalesce(s.name, ''))) = clean.value
              or lower(trim(coalesce(s.local_code, ''))) = clean.value
              or lower(trim(coalesce(s.slug, ''))) = clean.value
          )

        union all

        select up.email, 3 as priority
        from public.user_profiles up
        cross join clean
        where lower(trim(coalesce(up.display_name, ''))) = clean.value
    ) as resolved
    order by resolved.priority
    limit 1;
$$;

revoke all on function public.resolve_tenant_login_email(text) from public;
grant execute on function public.resolve_tenant_login_email(text) to authenticated;

drop policy if exists "Admins can manage app profiles" on public.user_profiles;
create policy "Admins can manage app profiles"
on public.user_profiles for all
using (public.is_mall_admin())
with check (public.is_mall_admin());

-- No se siembra administrador por email fijo.
-- Usa supabase/admin_login_hardening_20260530.sql para migrar administradores
-- desde perfiles existentes a public.admin_members.

alter table public.tenant_applications
    add column if not exists applicant_auth_user_id uuid references auth.users(id) on delete set null;

alter table public.tenant_applications enable row level security;

drop policy if exists "Anyone can submit tenant applications" on public.tenant_applications;
create policy "Anyone can submit tenant applications"
on public.tenant_applications for insert
with check (true);

drop policy if exists "Authenticated users can read tenant applications" on public.tenant_applications;
create policy "Authenticated users can read tenant applications"
on public.tenant_applications for select
using (public.is_mall_admin());

drop policy if exists "Mall admins can update tenant applications" on public.tenant_applications;
create policy "Mall admins can update tenant applications"
on public.tenant_applications for update
using (public.is_mall_admin())
with check (public.is_mall_admin());

alter table public.stores enable row level security;

drop policy if exists "Stores are public readable" on public.stores;
create policy "Stores are public readable"
on public.stores for select
using (true);

drop policy if exists "Tenants can update owned stores" on public.stores;
create policy "Tenants can update owned stores"
on public.stores for update
using (
    auth.uid() = owner_id
    or public.is_mall_admin()
)
with check (
    auth.uid() = owner_id
    or public.is_mall_admin()
);

alter table public.store_products enable row level security;

drop policy if exists "Store products are public readable" on public.store_products;
create policy "Store products are public readable"
on public.store_products for select
using (true);

drop policy if exists "Tenants manage products for owned stores" on public.store_products;
create policy "Tenants manage products for owned stores"
on public.store_products for all
using (
    exists (
        select 1 from public.stores s
        where (s.id::text = store_products.local_code or s.local_code = store_products.local_code)
        and s.owner_id = auth.uid()
    )
    or public.is_mall_admin()
)
with check (
    exists (
        select 1 from public.stores s
        where (s.id::text = store_products.local_code or s.local_code = store_products.local_code)
        and s.owner_id = auth.uid()
    )
    or public.is_mall_admin()
);

grant usage on schema public to anon, authenticated;
grant select on public.stores, public.store_products to anon, authenticated;
grant insert on public.tenant_applications, public.contact_messages to anon, authenticated;
grant select, insert, update on public.user_profiles, public.mall_members to authenticated;
grant select, update on public.tenant_applications, public.stores to authenticated;
grant insert, update, delete on public.store_products to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
