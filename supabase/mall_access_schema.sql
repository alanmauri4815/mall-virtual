-- Mall access model: visitors, registered members and tenants.
-- Run this in Supabase SQL Editor after enabling Email Auth.
-- For phone ownership checks, also enable Authentication > Providers > Phone.

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

drop policy if exists "Admins can manage app profiles" on public.user_profiles;
create policy "Admins can manage app profiles"
on public.user_profiles for all
using (public.is_mall_admin())
with check (public.is_mall_admin());

-- No se siembra administrador por email fijo.
-- Usa supabase/admin_login_hardening_20260530.sql para migrar administradores
-- desde perfiles existentes a public.admin_members.

create table if not exists public.mall_members (
    auth_user_id uuid primary key references auth.users(id) on delete cascade,
    nickname text not null,
    email text not null unique,
    phone text not null unique,
    email_verified boolean not null default false,
    phone_verified boolean not null default false,
    marketing_opt_in boolean not null default true,
    role text not null default 'member',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.mall_members enable row level security;

drop policy if exists "Members can read own profile" on public.mall_members;
create policy "Members can read own profile"
on public.mall_members for select
using (auth.uid() = auth_user_id);

drop policy if exists "Members can insert own profile" on public.mall_members;
create policy "Members can insert own profile"
on public.mall_members for insert
with check (auth.uid() = auth_user_id);

drop policy if exists "Members can update own profile" on public.mall_members;
create policy "Members can update own profile"
on public.mall_members for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

create or replace function public.resolve_member_login_email(login_identifier text)
returns text
language sql
security definer
set search_path = public
as $$
    select email
    from public.mall_members
    where lower(nickname) = lower(trim(login_identifier))
    limit 1;
$$;

revoke all on function public.resolve_member_login_email(text) from public;
grant execute on function public.resolve_member_login_email(text) to authenticated;

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

create table if not exists public.tenant_applications (
    id bigint generated by default as identity primary key,
    brand_name text not null,
    category text,
    email text not null,
    phone text not null,
    social_link text,
    applicant_auth_user_id uuid references auth.users(id) on delete set null,
    status text not null default 'pending',
    created_at timestamptz not null default now()
);

alter table public.tenant_applications add column if not exists applicant_auth_user_id uuid references auth.users(id) on delete set null;

update public.tenant_applications ta
set applicant_auth_user_id = au.id
from auth.users au
where ta.applicant_auth_user_id is null
  and lower(ta.email) = lower(au.email);

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

create table if not exists public.stores (
    id text primary key,
    local_code text unique not null,
    owner_id uuid references auth.users(id) on delete set null,
    slug text unique,
    name text not null,
    category text,
    contact_email text,
    contact_phone text,
    whatsapp text,
    logo_url text,
    shelf_style text default 'madera',
    primary_color text default '#c9a66b',
    checkout_mode text default 'whatsapp',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

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

create table if not exists public.store_products (
    id bigint generated by default as identity primary key,
    local_code text not null references public.stores(local_code) on delete cascade,
    name text not null,
    price text,
    image_url text,
    sort_order int default 0,
    created_at timestamptz not null default now()
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
        where (s.local_code = store_products.local_code or s.id::text = store_products.local_code)
        and s.owner_id = auth.uid()
    )
    or public.is_mall_admin()
)
with check (
    exists (
        select 1 from public.stores s
        where (s.local_code = store_products.local_code or s.id::text = store_products.local_code)
        and s.owner_id = auth.uid()
    )
    or public.is_mall_admin()
);

create table if not exists public.contact_messages (
    id bigint generated by default as identity primary key,
    store_id text,
    name text not null,
    email text not null,
    requirement text not null,
    requester_role text default 'guest',
    requester_nickname text,
    requester_member_id uuid,
    created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can send store messages" on public.contact_messages;
create policy "Anyone can send store messages"
on public.contact_messages for insert
with check (true);

drop policy if exists "Tenants can read messages for owned stores" on public.contact_messages;
create policy "Tenants can read messages for owned stores"
on public.contact_messages for select
using (
    exists (
        select 1 from public.stores s
        where (s.local_code = contact_messages.store_id or s.id::text = contact_messages.store_id)
        and s.owner_id = auth.uid()
    )
);

-- Backward-compatible migrations for older tables.
alter table public.stores add column if not exists local_code text;
alter table public.stores add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.stores add column if not exists category text;
alter table public.stores add column if not exists contact_email text;
alter table public.stores add column if not exists contact_phone text;
alter table public.stores add column if not exists whatsapp text;
alter table public.stores add column if not exists logo_url text;
alter table public.stores add column if not exists shelf_style text default 'madera';

update public.stores
set local_code = id::text
where local_code is null
  and id is not null;

update public.stores s
set contact_email = au.email
from auth.users au
where s.contact_email is null
  and s.owner_id = au.id;

update public.stores s
set contact_email = ta.email,
    category = coalesce(s.category, ta.category),
    name = coalesce(s.name, ta.brand_name)
from public.tenant_applications ta
where s.contact_email is null
  and lower(trim(coalesce(s.name, ''))) = lower(trim(ta.brand_name))
  and lower(coalesce(ta.status, 'pending')) = 'approved';

alter table public.contact_messages add column if not exists requester_role text default 'guest';
alter table public.contact_messages add column if not exists requester_nickname text;
alter table public.contact_messages add column if not exists requester_member_id uuid;

alter table public.user_profiles add column if not exists last_pos jsonb;
alter table public.store_products add column if not exists local_code text;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'store_products'
          and column_name = 'store_id'
    ) then
        update public.store_products
        set local_code = store_id::text
        where local_code is null
          and store_id is not null;
    end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select on public.stores, public.store_products to anon, authenticated;
grant insert on public.tenant_applications, public.contact_messages to anon, authenticated;
grant select, insert, update on public.user_profiles, public.mall_members to authenticated;
grant select, update on public.tenant_applications, public.stores to authenticated;
grant insert, update, delete on public.store_products to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
