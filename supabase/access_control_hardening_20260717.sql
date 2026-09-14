-- Mall Emprendimientos - access control hardening.
-- Run once in Supabase SQL Editor as the project owner.
-- This migration makes admin_members the only source of admin authority.

begin;

create table if not exists public.admin_members (
    auth_user_id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

-- The known project administrator must exist in Auth before continuing.
do $$
begin
    if not exists (
        select 1
        from auth.users
        where id = '2545564b-41e4-47f4-93ea-ec22b8b0ee7e'::uuid
          and lower(email) = 'alanmauri4815@gmail.com'
    ) then
        raise exception 'The expected administrator UID/email was not found in auth.users.';
    end if;
end $$;

insert into public.admin_members (auth_user_id, email)
values ('2545564b-41e4-47f4-93ea-ec22b8b0ee7e'::uuid, 'alanmauri4815@gmail.com')
on conflict (auth_user_id) do update
set email = excluded.email;

create or replace function public.is_mall_admin()
returns boolean
language sql
stable
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
revoke execute on function public.is_mall_admin() from anon;
grant execute on function public.is_mall_admin() to authenticated;

-- A normal user may edit profile data, but never UID, email or role.
create or replace function public.protect_user_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if public.is_mall_admin() then
        return new;
    end if;

    if auth.uid() is null or new.auth_user_id <> auth.uid() then
        raise exception 'Profile access denied.';
    end if;

    if tg_op = 'INSERT' then
        new.role := 'registered_visitor';
        new.email := lower(coalesce(auth.jwt() ->> 'email', new.email));
    else
        new.auth_user_id := old.auth_user_id;
        new.email := old.email;
        new.role := old.role;
    end if;
    return new;
end;
$$;

revoke all on function public.protect_user_profile_security_fields() from public;

drop trigger if exists protect_user_profile_security_fields_trigger on public.user_profiles;
create trigger protect_user_profile_security_fields_trigger
before insert or update on public.user_profiles
for each row execute function public.protect_user_profile_security_fields();

alter table public.user_profiles enable row level security;
alter table public.admin_members enable row level security;
alter table public.mall_members enable row level security;
alter table public.tenant_applications enable row level security;
alter table public.stores enable row level security;
alter table public.store_products enable row level security;
alter table public.contact_messages enable row level security;
alter table public.mall_messages enable row level security;
alter table public.store_rent_rates enable row level security;
alter table public.tenant_leases enable row level security;
alter table public.tenant_payments enable row level security;
alter table public.tenant_notes enable row level security;
alter table public.physical_spaces enable row level security;
alter table public.store_physical_links enable row level security;

-- Remove every previous policy from the sensitive tables so no permissive legacy
-- policy remains active alongside the definitive rules below.
do $$
declare
    policy_row record;
begin
    for policy_row in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = any (array[
              'user_profiles', 'admin_members', 'mall_members',
              'tenant_applications', 'stores', 'store_products',
              'contact_messages', 'mall_messages', 'store_rent_rates',
              'tenant_leases', 'tenant_payments', 'tenant_notes',
              'physical_spaces', 'store_physical_links'
          ])
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            policy_row.policyname,
            policy_row.schemaname,
            policy_row.tablename
        );
    end loop;
end $$;

create policy "Users read own profile"
on public.user_profiles for select to authenticated
using (auth.uid() = auth_user_id or public.is_mall_admin());

create policy "Users insert own basic profile"
on public.user_profiles for insert to authenticated
with check (auth.uid() = auth_user_id and role = 'registered_visitor');

create policy "Users update own profile"
on public.user_profiles for update to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

create policy "Admins manage profiles"
on public.user_profiles for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create policy "Admins and self read admin membership"
on public.admin_members for select to authenticated
using (public.is_mall_admin() or auth.uid() = auth_user_id);

create policy "Admins manage admin membership"
on public.admin_members for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create policy "Members read own profile"
on public.mall_members for select to authenticated
using (auth.uid() = auth_user_id or public.is_mall_admin());

create policy "Members insert own profile"
on public.mall_members for insert to authenticated
with check (auth.uid() = auth_user_id);

create policy "Members update own profile"
on public.mall_members for update to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

create policy "Admins manage member profiles"
on public.mall_members for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create policy "Public submits pending applications"
on public.tenant_applications for insert to anon, authenticated
with check (
    lower(coalesce(status, 'pending')) = 'pending'
    and (applicant_auth_user_id is null or applicant_auth_user_id = auth.uid())
);

create policy "Admins manage applications"
on public.tenant_applications for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create policy "Public reads store catalog"
on public.stores for select to anon, authenticated
using (true);

create policy "Owners update own stores"
on public.stores for update to authenticated
using (owner_id = auth.uid() or public.is_mall_admin())
with check (owner_id = auth.uid() or public.is_mall_admin());

create policy "Public reads products"
on public.store_products for select to anon, authenticated
using (true);

create policy "Owners manage own products"
on public.store_products for all to authenticated
using (
    public.is_mall_admin()
    or exists (
        select 1 from public.stores s
        where (s.local_code = store_products.local_code or s.id::text = store_products.local_code)
          and s.owner_id = auth.uid()
    )
)
with check (
    public.is_mall_admin()
    or exists (
        select 1 from public.stores s
        where (s.local_code = store_products.local_code or s.id::text = store_products.local_code)
          and s.owner_id = auth.uid()
    )
);

create policy "Public sends contact messages"
on public.contact_messages for insert to anon, authenticated
with check (requester_member_id is null or requester_member_id = auth.uid());

create policy "Owners read own contact messages"
on public.contact_messages for select to authenticated
using (
    public.is_mall_admin()
    or exists (
        select 1 from public.stores s
        where (s.local_code = contact_messages.store_id or s.id::text = contact_messages.store_id)
          and s.owner_id = auth.uid()
    )
);

create policy "Public sends mall messages"
on public.mall_messages for insert to anon, authenticated
with check (requester_member_id is null or requester_member_id = auth.uid());

create policy "Owners read own mall messages"
on public.mall_messages for select to authenticated
using (
    public.is_mall_admin()
    or exists (
        select 1 from public.stores s
        where (
            s.id = mall_messages.store_id
            or s.local_code = mall_messages.local_code
            or s.id::text = mall_messages.local_code
        )
          and s.owner_id = auth.uid()
    )
);

create policy "Admins manage rent rates"
on public.store_rent_rates for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create policy "Owners read own rent rates"
on public.store_rent_rates for select to authenticated
using (
    public.is_mall_admin()
    or exists (
        select 1 from public.stores s
        where s.id = store_rent_rates.store_id and s.owner_id = auth.uid()
    )
);

create policy "Admins manage leases"
on public.tenant_leases for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create policy "Owners read own leases"
on public.tenant_leases for select to authenticated
using (
    public.is_mall_admin()
    or tenant_auth_user_id = auth.uid()
    or exists (
        select 1 from public.stores s
        where s.id = tenant_leases.store_id and s.owner_id = auth.uid()
    )
);

create policy "Admins manage payments"
on public.tenant_payments for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create policy "Owners read own payments"
on public.tenant_payments for select to authenticated
using (
    public.is_mall_admin()
    or tenant_auth_user_id = auth.uid()
    or exists (
        select 1 from public.stores s
        where s.id = tenant_payments.store_id and s.owner_id = auth.uid()
    )
);

create policy "Admins manage notes"
on public.tenant_notes for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create policy "Owners read visible notes"
on public.tenant_notes for select to authenticated
using (
    public.is_mall_admin()
    or (
        visibility = 'tenant'
        and (
            tenant_auth_user_id = auth.uid()
            or exists (
                select 1 from public.stores s
                where s.id = tenant_notes.store_id and s.owner_id = auth.uid()
            )
        )
    )
);

create policy "Admins manage physical spaces"
on public.physical_spaces for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create policy "Admins manage physical links"
on public.store_physical_links for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

-- Remove legacy store-assets policies only; policies for other buckets are preserved.
do $$
declare
    policy_row record;
begin
    for policy_row in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and (
              coalesce(qual, '') ilike '%store-assets%'
              or coalesce(with_check, '') ilike '%store-assets%'
              or policyname in (
                  'Store assets are publicly readable',
                  'Tenants upload owned store assets',
                  'Tenants update owned store assets',
                  'Tenants delete owned store assets'
              )
          )
    loop
        execute format('drop policy if exists %I on storage.objects', policy_row.policyname);
    end loop;
end $$;

create policy "Store assets are publicly readable"
on storage.objects for select to public
using (bucket_id = 'store-assets');

create policy "Owners upload own store assets"
on storage.objects for insert to authenticated
with check (
    bucket_id = 'store-assets'
    and exists (
        select 1 from public.stores s
        where (s.local_code = (storage.foldername(name))[1] or s.id::text = (storage.foldername(name))[1])
          and (s.owner_id = auth.uid() or public.is_mall_admin())
    )
);

create policy "Owners update own store assets"
on storage.objects for update to authenticated
using (
    bucket_id = 'store-assets'
    and exists (
        select 1 from public.stores s
        where (s.local_code = (storage.foldername(name))[1] or s.id::text = (storage.foldername(name))[1])
          and (s.owner_id = auth.uid() or public.is_mall_admin())
    )
)
with check (
    bucket_id = 'store-assets'
    and exists (
        select 1 from public.stores s
        where (s.local_code = (storage.foldername(name))[1] or s.id::text = (storage.foldername(name))[1])
          and (s.owner_id = auth.uid() or public.is_mall_admin())
    )
);

create policy "Owners delete own store assets"
on storage.objects for delete to authenticated
using (
    bucket_id = 'store-assets'
    and exists (
        select 1 from public.stores s
        where (s.local_code = (storage.foldername(name))[1] or s.id::text = (storage.foldername(name))[1])
          and (s.owner_id = auth.uid() or public.is_mall_admin())
    )
);

-- Remove obsolete RPCs that reveal login emails from public identifiers.
do $$
begin
    if to_regprocedure('public.resolve_member_login_email(text)') is not null then
        revoke all on function public.resolve_member_login_email(text) from public;
        revoke execute on function public.resolve_member_login_email(text) from anon;
        revoke execute on function public.resolve_member_login_email(text) from authenticated;
    end if;
    if to_regprocedure('public.resolve_tenant_login_email(text)') is not null then
        revoke all on function public.resolve_tenant_login_email(text) from public;
        revoke execute on function public.resolve_tenant_login_email(text) from anon;
        revoke execute on function public.resolve_tenant_login_email(text) from authenticated;
    end if;
end $$;

-- Rebuild explicit SQL grants. RLS remains the row-level authority.
revoke all on public.user_profiles, public.admin_members, public.mall_members,
    public.tenant_applications, public.stores, public.store_products,
    public.contact_messages, public.mall_messages, public.store_rent_rates,
    public.tenant_leases, public.tenant_payments, public.tenant_notes,
    public.physical_spaces, public.store_physical_links
from anon, authenticated;

grant select on public.stores, public.store_products to anon, authenticated;
grant insert on public.tenant_applications, public.contact_messages, public.mall_messages to anon, authenticated;

grant select, insert, update on public.user_profiles, public.mall_members to authenticated;
grant select, insert, update, delete on public.admin_members to authenticated;
grant select, update, delete on public.tenant_applications to authenticated;
grant update on public.stores to authenticated;
grant insert, update, delete on public.store_products to authenticated;
grant select on public.contact_messages, public.mall_messages to authenticated;
grant select, insert, update on public.store_rent_rates, public.tenant_leases,
    public.tenant_payments, public.tenant_notes to authenticated;
grant select, insert, update, delete on public.physical_spaces, public.store_physical_links to authenticated;

commit;

-- Expected result: only intended accounts should be listed here.
select auth_user_id, email, created_at
from public.admin_members
order by created_at;

-- Review the definitive policies after applying the migration.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where (schemaname = 'public' and tablename = any (array[
    'user_profiles', 'admin_members', 'tenant_applications', 'stores',
    'store_products', 'contact_messages', 'mall_messages',
    'store_rent_rates', 'tenant_leases', 'tenant_payments', 'tenant_notes'
])) or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
