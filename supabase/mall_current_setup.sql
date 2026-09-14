-- Mall Emprendimientos - esquema actual maestro.
-- Ejecutar en Supabase SQL Editor para alinear Auth, RLS, tiendas, productos,
-- postulaciones, mensajes y Storage con la version actual de index.html.

begin;

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

create table if not exists public.admin_members (
    auth_user_id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

alter table public.admin_members enable row level security;

create or replace function public.is_mall_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select auth.uid() is not null and (
        exists (
            select 1
            from public.admin_members am
            where am.auth_user_id = auth.uid()
        )
        or exists (
            select 1
            from public.user_profiles p
            where p.auth_user_id = auth.uid()
              and p.role = 'admin'
        )
    );
$$;

revoke all on function public.is_mall_admin() from public;
grant execute on function public.is_mall_admin() to authenticated;

drop policy if exists "Admins can read admin members" on public.admin_members;
create policy "Admins can read admin members"
on public.admin_members for select
using (public.is_mall_admin() or auth.uid() = auth_user_id);

drop policy if exists "Admins can manage admin members" on public.admin_members;
create policy "Admins can manage admin members"
on public.admin_members for all
using (public.is_mall_admin())
with check (public.is_mall_admin());

insert into public.admin_members (auth_user_id, email)
select p.auth_user_id, p.email
from public.user_profiles p
where p.role = 'admin'
on conflict (auth_user_id) do update
set email = excluded.email;

create or replace function public.is_mall_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select auth.uid() is not null and exists (
        select 1
        from public.admin_members am
        where am.auth_user_id = auth.uid()
    );
$$;

revoke all on function public.is_mall_admin() from public;
grant execute on function public.is_mall_admin() to authenticated;

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

drop policy if exists "Admins can manage app profiles" on public.user_profiles;
create policy "Admins can manage app profiles"
on public.user_profiles for all
using (public.is_mall_admin())
with check (public.is_mall_admin());

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

alter table public.mall_members add column if not exists auth_user_id uuid;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'mall_members'
          and column_name = 'id'
    ) then
        execute '
            update public.mall_members
            set auth_user_id = id
            where auth_user_id is null
              and id is not null
        ';
    end if;
end $$;

create unique index if not exists mall_members_auth_user_id_idx
on public.mall_members (auth_user_id)
where auth_user_id is not null;

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

alter table public.tenant_applications
    add column if not exists applicant_auth_user_id uuid references auth.users(id) on delete set null;

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

drop policy if exists "Mall admins can read tenant applications" on public.tenant_applications;
drop policy if exists "Authenticated users can read tenant applications" on public.tenant_applications;
create policy "Mall admins can read tenant applications"
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
    social_url text,
    address text,
    maps_url text,
    logo_url text,
    shelf_style text default 'madera',
    primary_color text default '#c9a66b',
    checkout_mode text default 'whatsapp',
    telegram_notifications_enabled boolean not null default false,
    telegram_chat_id text,
    telegram_chat_username text,
    telegram_link_code text,
    telegram_verified_at timestamptz,
    service_status text not null default 'active',
    service_status_note text,
    service_suspended_at timestamptz,
    product_tier text,
    product_limit int,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.stores add column if not exists local_code text;
alter table public.stores add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.stores add column if not exists slug text;
alter table public.stores add column if not exists category text;
alter table public.stores add column if not exists contact_email text;
alter table public.stores add column if not exists contact_phone text;
alter table public.stores add column if not exists whatsapp text;
alter table public.stores add column if not exists social_url text;
alter table public.stores add column if not exists address text;
alter table public.stores add column if not exists maps_url text;
alter table public.stores add column if not exists logo_url text;
alter table public.stores add column if not exists shelf_style text default 'madera';
alter table public.stores add column if not exists primary_color text default '#c9a66b';
alter table public.stores add column if not exists checkout_mode text default 'whatsapp';
alter table public.stores add column if not exists telegram_notifications_enabled boolean not null default false;
alter table public.stores add column if not exists telegram_chat_id text;
alter table public.stores add column if not exists telegram_chat_username text;
alter table public.stores add column if not exists telegram_link_code text;
alter table public.stores add column if not exists telegram_verified_at timestamptz;
alter table public.stores add column if not exists service_status text not null default 'active';
alter table public.stores add column if not exists service_status_note text;
alter table public.stores add column if not exists service_suspended_at timestamptz;
alter table public.stores add column if not exists product_tier text;
alter table public.stores add column if not exists product_limit int;
alter table public.stores add column if not exists updated_at timestamptz not null default now();

alter table public.stores
    drop constraint if exists stores_product_tier_chk;
alter table public.stores
    add constraint stores_product_tier_chk
    check (product_tier is null or product_tier in ('T0', 'T1', 'T2', 'T3', 'T4', 'T5'));

alter table public.stores
    drop constraint if exists stores_product_limit_chk;
alter table public.stores
    add constraint stores_product_limit_chk
    check (product_limit is null or product_limit between 1 and 50);

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

create unique index if not exists stores_local_code_unique_idx
on public.stores (local_code)
where local_code is not null;

alter table public.stores enable row level security;

drop policy if exists "Stores are public readable" on public.stores;
create policy "Stores are public readable"
on public.stores for select
using (true);

drop policy if exists "Tenants can update owned stores" on public.stores;
create policy "Tenants can update owned stores"
on public.stores for update
using (auth.uid() = owner_id or public.is_mall_admin())
with check (auth.uid() = owner_id or public.is_mall_admin());

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
              or lower(trim(coalesce(s.id::text, ''))) = clean.value
          )

        union all

        select up.email, 3 as priority
        from public.user_profiles up
        cross join clean
        where lower(trim(coalesce(up.display_name, ''))) = clean.value
    ) as resolved
    where resolved.email is not null
    order by resolved.priority
    limit 1;
$$;

revoke all on function public.resolve_tenant_login_email(text) from public;
grant execute on function public.resolve_tenant_login_email(text) to authenticated;

create table if not exists public.store_products (
    id bigint generated by default as identity primary key,
    local_code text not null,
    name text not null,
    price text,
    image_url text,
    description text,
    slot_index int,
    sort_order int default 0,
    created_at timestamptz not null default now()
);

alter table public.store_products add column if not exists local_code text;
alter table public.store_products add column if not exists image_url text;
alter table public.store_products add column if not exists description text;
alter table public.store_products add column if not exists slot_index int;
alter table public.store_products add column if not exists sort_order int default 0;

alter table public.store_products
    drop constraint if exists store_products_description_length_chk;
alter table public.store_products
    add constraint store_products_description_length_chk
    check (description is null or char_length(description) <= 500);

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

create index if not exists store_products_local_code_idx
on public.store_products (local_code);

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
        select 1
        from public.stores s
        where (s.local_code = store_products.local_code or s.id::text = store_products.local_code)
          and s.owner_id = auth.uid()
    )
    or public.is_mall_admin()
)
with check (
    exists (
        select 1
        from public.stores s
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

alter table public.contact_messages add column if not exists requester_role text default 'guest';
alter table public.contact_messages add column if not exists requester_nickname text;
alter table public.contact_messages add column if not exists requester_member_id uuid;
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
        select 1
        from public.stores s
        where (s.local_code = contact_messages.store_id or s.id::text = contact_messages.store_id)
          and s.owner_id = auth.uid()
    )
    or public.is_mall_admin()
);

create table if not exists public.mall_messages (
    id bigint generated by default as identity primary key,
    store_id text,
    local_code text,
    sender_name text not null,
    sender_email text not null,
    sender_phone text,
    message text not null,
    status text not null default 'unread',
    requester_role text default 'guest',
    requester_nickname text,
    requester_member_id uuid,
    created_at timestamptz not null default now()
);

alter table public.mall_messages add column if not exists store_id text;
alter table public.mall_messages add column if not exists local_code text;
alter table public.mall_messages add column if not exists sender_name text;
alter table public.mall_messages add column if not exists sender_email text;
alter table public.mall_messages add column if not exists sender_phone text;
alter table public.mall_messages add column if not exists message text;
alter table public.mall_messages add column if not exists status text not null default 'unread';
alter table public.mall_messages add column if not exists requester_role text default 'guest';
alter table public.mall_messages add column if not exists requester_nickname text;
alter table public.mall_messages add column if not exists requester_member_id uuid;
alter table public.mall_messages add column if not exists created_at timestamptz not null default now();

create index if not exists mall_messages_store_id_idx
on public.mall_messages (store_id);

create index if not exists mall_messages_local_code_idx
on public.mall_messages (local_code);

alter table public.mall_messages enable row level security;

drop policy if exists "Anyone can send mall messages" on public.mall_messages;
create policy "Anyone can send mall messages"
on public.mall_messages for insert
with check (true);

drop policy if exists "Tenants can read messages for owned mall stores" on public.mall_messages;
create policy "Tenants can read messages for owned mall stores"
on public.mall_messages for select
using (
    exists (
        select 1
        from public.stores s
        where (
            s.id = mall_messages.store_id
            or s.local_code = mall_messages.local_code
            or s.id::text = mall_messages.local_code
        )
          and s.owner_id = auth.uid()
    )
    or public.is_mall_admin()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'store-assets',
    'store-assets',
    true,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Store assets are publicly readable" on storage.objects;
create policy "Store assets are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'store-assets');

drop policy if exists "Tenants upload owned store assets" on storage.objects;
create policy "Tenants upload owned store assets"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'store-assets'
    and exists (
        select 1
        from public.stores st
        where (st.local_code = (storage.foldername(storage.objects.name))[1] or st.id::text = (storage.foldername(storage.objects.name))[1])
          and (
              st.owner_id = auth.uid()
              or public.is_mall_admin()
          )
    )
);

drop policy if exists "Tenants update owned store assets" on storage.objects;
create policy "Tenants update owned store assets"
on storage.objects for update
to authenticated
using (
    bucket_id = 'store-assets'
    and exists (
        select 1
        from public.stores st
        where (st.local_code = (storage.foldername(storage.objects.name))[1] or st.id::text = (storage.foldername(storage.objects.name))[1])
          and (
              st.owner_id = auth.uid()
              or public.is_mall_admin()
          )
    )
)
with check (
    bucket_id = 'store-assets'
    and exists (
        select 1
        from public.stores st
        where (st.local_code = (storage.foldername(storage.objects.name))[1] or st.id::text = (storage.foldername(storage.objects.name))[1])
          and (
              st.owner_id = auth.uid()
              or public.is_mall_admin()
          )
    )
);

drop policy if exists "Tenants delete owned store assets" on storage.objects;
create policy "Tenants delete owned store assets"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'store-assets'
    and exists (
        select 1
        from public.stores st
        where (st.local_code = (storage.foldername(storage.objects.name))[1] or st.id::text = (storage.foldername(storage.objects.name))[1])
          and (
              st.owner_id = auth.uid()
              or public.is_mall_admin()
          )
    )
);

create table if not exists public.store_rent_rates (
    id bigint generated by default as identity primary key,
    store_id text not null references public.stores(id) on delete cascade,
    local_code text,
    floor int,
    included_products int,
    currency text not null default 'CLP',
    monthly_amount integer not null default 0,
    quarterly_total integer,
    quarterly_monthly_equivalent integer,
    semiannual_total integer,
    semiannual_monthly_equivalent integer,
    annual_total integer,
    annual_monthly_equivalent integer,
    notes text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.store_rent_rates add column if not exists local_code text;
alter table public.store_rent_rates add column if not exists floor int;
alter table public.store_rent_rates add column if not exists included_products int;
alter table public.store_rent_rates add column if not exists currency text not null default 'CLP';
alter table public.store_rent_rates add column if not exists monthly_amount integer not null default 0;
alter table public.store_rent_rates add column if not exists quarterly_total integer;
alter table public.store_rent_rates add column if not exists quarterly_monthly_equivalent integer;
alter table public.store_rent_rates add column if not exists semiannual_total integer;
alter table public.store_rent_rates add column if not exists semiannual_monthly_equivalent integer;
alter table public.store_rent_rates add column if not exists annual_total integer;
alter table public.store_rent_rates add column if not exists annual_monthly_equivalent integer;
alter table public.store_rent_rates add column if not exists notes text;
alter table public.store_rent_rates add column if not exists active boolean not null default true;
alter table public.store_rent_rates add column if not exists updated_at timestamptz not null default now();

update public.store_rent_rates rr
set local_code = s.local_code
from public.stores s
where rr.store_id = s.id
  and rr.local_code is null;

create unique index if not exists store_rent_rates_store_id_unique_idx
on public.store_rent_rates (store_id);

create index if not exists store_rent_rates_local_code_idx
on public.store_rent_rates (local_code);

alter table public.store_rent_rates enable row level security;

drop policy if exists "Admins manage store rent rates" on public.store_rent_rates;
create policy "Admins manage store rent rates"
on public.store_rent_rates for all
using (public.is_mall_admin())
with check (public.is_mall_admin());

drop policy if exists "Tenants read own store rent rates" on public.store_rent_rates;
create policy "Tenants read own store rent rates"
on public.store_rent_rates for select
using (
    public.is_mall_admin()
    or exists (
        select 1
        from public.stores s
        where s.id = store_rent_rates.store_id
          and s.owner_id = auth.uid()
    )
);

create table if not exists public.tenant_leases (
    id bigint generated by default as identity primary key,
    store_id text not null references public.stores(id) on delete restrict,
    local_code text,
    tenant_auth_user_id uuid references auth.users(id) on delete set null,
    tenant_application_id text,
    tenant_name_snapshot text,
    tenant_email_snapshot text,
    tenant_phone_snapshot text,
    status text not null default 'active'
        check (status in ('draft', 'active', 'ended', 'cancelled', 'suspended')),
    billing_cycle text not null default 'monthly'
        check (billing_cycle in ('monthly', 'quarterly', 'semiannual', 'annual', 'custom')),
    monthly_amount integer not null default 0,
    billing_amount integer,
    discount_amount integer not null default 0,
    deposit_amount integer not null default 0,
    start_date date not null,
    end_date date,
    due_day smallint not null default 1 check (due_day between 1 and 31),
    contract_signed_at timestamptz,
    ended_at timestamptz,
    ended_reason text,
    admin_notes text,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.tenant_leases add column if not exists local_code text;
alter table public.tenant_leases add column if not exists tenant_auth_user_id uuid references auth.users(id) on delete set null;
alter table public.tenant_leases add column if not exists tenant_application_id text;
alter table public.tenant_leases add column if not exists tenant_name_snapshot text;
alter table public.tenant_leases add column if not exists tenant_email_snapshot text;
alter table public.tenant_leases add column if not exists tenant_phone_snapshot text;
alter table public.tenant_leases add column if not exists status text not null default 'active';
alter table public.tenant_leases add column if not exists billing_cycle text not null default 'monthly';
alter table public.tenant_leases add column if not exists monthly_amount integer not null default 0;
alter table public.tenant_leases add column if not exists billing_amount integer;
alter table public.tenant_leases add column if not exists discount_amount integer not null default 0;
alter table public.tenant_leases add column if not exists deposit_amount integer not null default 0;
alter table public.tenant_leases add column if not exists due_day smallint not null default 1;
alter table public.tenant_leases add column if not exists contract_signed_at timestamptz;
alter table public.tenant_leases add column if not exists ended_at timestamptz;
alter table public.tenant_leases add column if not exists ended_reason text;
alter table public.tenant_leases add column if not exists admin_notes text;
alter table public.tenant_leases add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.tenant_leases add column if not exists updated_at timestamptz not null default now();

update public.tenant_leases tl
set local_code = s.local_code
from public.stores s
where tl.store_id = s.id
  and tl.local_code is null;

create index if not exists tenant_leases_store_id_idx
on public.tenant_leases (store_id);

create index if not exists tenant_leases_tenant_auth_user_id_idx
on public.tenant_leases (tenant_auth_user_id);

create index if not exists tenant_leases_status_idx
on public.tenant_leases (status);

alter table public.tenant_leases enable row level security;

drop policy if exists "Admins manage tenant leases" on public.tenant_leases;
create policy "Admins manage tenant leases"
on public.tenant_leases for all
using (public.is_mall_admin())
with check (public.is_mall_admin());

drop policy if exists "Tenants read own leases" on public.tenant_leases;
create policy "Tenants read own leases"
on public.tenant_leases for select
using (
    public.is_mall_admin()
    or tenant_auth_user_id = auth.uid()
    or exists (
        select 1
        from public.stores s
        where s.id = tenant_leases.store_id
          and s.owner_id = auth.uid()
    )
);

create table if not exists public.tenant_payments (
    id bigint generated by default as identity primary key,
    lease_id bigint not null references public.tenant_leases(id) on delete cascade,
    store_id text not null references public.stores(id) on delete restrict,
    local_code text,
    tenant_auth_user_id uuid references auth.users(id) on delete set null,
    period_start date,
    period_end date,
    due_date date not null,
    paid_at timestamptz,
    amount_due integer not null default 0,
    amount_paid integer not null default 0,
    late_fee integer not null default 0,
    discount_amount integer not null default 0,
    payment_method text,
    payment_reference text,
    receipt_url text,
    status text not null default 'pending'
        check (status in ('pending', 'paid', 'partial', 'late', 'cancelled', 'refunded')),
    notes text,
    recorded_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.tenant_payments add column if not exists local_code text;
alter table public.tenant_payments add column if not exists tenant_auth_user_id uuid references auth.users(id) on delete set null;
alter table public.tenant_payments add column if not exists period_start date;
alter table public.tenant_payments add column if not exists period_end date;
alter table public.tenant_payments add column if not exists paid_at timestamptz;
alter table public.tenant_payments add column if not exists amount_due integer not null default 0;
alter table public.tenant_payments add column if not exists amount_paid integer not null default 0;
alter table public.tenant_payments add column if not exists late_fee integer not null default 0;
alter table public.tenant_payments add column if not exists discount_amount integer not null default 0;
alter table public.tenant_payments add column if not exists payment_method text;
alter table public.tenant_payments add column if not exists payment_reference text;
alter table public.tenant_payments add column if not exists receipt_url text;
alter table public.tenant_payments add column if not exists status text not null default 'pending';
alter table public.tenant_payments add column if not exists notes text;
alter table public.tenant_payments add column if not exists recorded_by uuid references auth.users(id) on delete set null;
alter table public.tenant_payments add column if not exists updated_at timestamptz not null default now();

update public.tenant_payments tp
set local_code = s.local_code
from public.stores s
where tp.store_id = s.id
  and tp.local_code is null;

create index if not exists tenant_payments_lease_id_idx
on public.tenant_payments (lease_id);

create index if not exists tenant_payments_store_id_idx
on public.tenant_payments (store_id);

create index if not exists tenant_payments_status_idx
on public.tenant_payments (status);

create index if not exists tenant_payments_due_date_idx
on public.tenant_payments (due_date);

alter table public.tenant_payments enable row level security;

drop policy if exists "Admins manage tenant payments" on public.tenant_payments;
create policy "Admins manage tenant payments"
on public.tenant_payments for all
using (public.is_mall_admin())
with check (public.is_mall_admin());

drop policy if exists "Tenants read own payments" on public.tenant_payments;
create policy "Tenants read own payments"
on public.tenant_payments for select
using (
    public.is_mall_admin()
    or tenant_auth_user_id = auth.uid()
    or exists (
        select 1
        from public.stores s
        where s.id = tenant_payments.store_id
          and s.owner_id = auth.uid()
    )
);

create table if not exists public.tenant_notes (
    id bigint generated by default as identity primary key,
    store_id text not null references public.stores(id) on delete cascade,
    local_code text,
    tenant_auth_user_id uuid references auth.users(id) on delete set null,
    lease_id bigint references public.tenant_leases(id) on delete set null,
    category text not null default 'general',
    visibility text not null default 'private'
        check (visibility in ('private', 'tenant')),
    pinned boolean not null default false,
    note text not null,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.tenant_notes add column if not exists local_code text;
alter table public.tenant_notes add column if not exists tenant_auth_user_id uuid references auth.users(id) on delete set null;
alter table public.tenant_notes add column if not exists lease_id bigint references public.tenant_leases(id) on delete set null;
alter table public.tenant_notes add column if not exists category text not null default 'general';
alter table public.tenant_notes add column if not exists visibility text not null default 'private';
alter table public.tenant_notes add column if not exists pinned boolean not null default false;
alter table public.tenant_notes add column if not exists note text;
alter table public.tenant_notes add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.tenant_notes add column if not exists updated_at timestamptz not null default now();

update public.tenant_notes tn
set local_code = s.local_code
from public.stores s
where tn.store_id = s.id
  and tn.local_code is null;

create index if not exists tenant_notes_store_id_idx
on public.tenant_notes (store_id);

create index if not exists tenant_notes_tenant_auth_user_id_idx
on public.tenant_notes (tenant_auth_user_id);

create index if not exists tenant_notes_visibility_idx
on public.tenant_notes (visibility);

alter table public.tenant_notes enable row level security;

drop policy if exists "Admins manage tenant notes" on public.tenant_notes;
create policy "Admins manage tenant notes"
on public.tenant_notes for all
using (public.is_mall_admin())
with check (public.is_mall_admin());

drop policy if exists "Tenants read visible notes" on public.tenant_notes;
create policy "Tenants read visible notes"
on public.tenant_notes for select
using (
    public.is_mall_admin()
    or (
        visibility = 'tenant'
        and (
            tenant_auth_user_id = auth.uid()
            or exists (
                select 1
                from public.stores s
                where s.id = tenant_notes.store_id
                  and s.owner_id = auth.uid()
            )
        )
    )
);

grant usage on schema public to anon, authenticated;
grant select on public.stores, public.store_products to anon, authenticated;
grant insert on public.tenant_applications, public.contact_messages, public.mall_messages to anon, authenticated;
grant select, insert, update on public.user_profiles, public.mall_members to authenticated;
grant select, update on public.tenant_applications, public.stores to authenticated;
grant insert, update, delete on public.store_products to authenticated;
grant select on public.store_rent_rates, public.tenant_leases, public.tenant_payments, public.tenant_notes, public.mall_messages to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

commit;
