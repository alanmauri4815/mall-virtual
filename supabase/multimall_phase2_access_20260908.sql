-- Segunda fase multimall: membresias administrativas y RLS por mall.
-- Ejecutar despues de multimall_core_scope_20260908.sql.
-- Es aditiva e idempotente. No habilita un segundo mall publico.

begin;

do $$
begin
    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'malls'
          and column_name = 'id'
    ) then
        raise exception 'Falta public.malls. Ejecuta primero multimall_registry_20260907.sql.';
    end if;

    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'stores'
          and column_name = 'mall_id'
    ) then
        raise exception 'Falta mall_id en public.stores. Ejecuta primero multimall_core_scope_20260908.sql.';
    end if;
end;
$$;

create table if not exists public.mall_admin_memberships (
    mall_id uuid not null references public.malls(id) on delete cascade,
    auth_user_id uuid not null references auth.users(id) on delete cascade,
    role text not null default 'admin' check (role in ('admin', 'editor')),
    created_at timestamptz not null default now(),
    created_by uuid references auth.users(id) on delete set null,
    primary key (mall_id, auth_user_id)
);

create index if not exists mall_admin_memberships_user_idx
on public.mall_admin_memberships (auth_user_id, mall_id);

alter table public.mall_admin_memberships enable row level security;
revoke all on public.mall_admin_memberships from public, anon;
grant select on public.mall_admin_memberships to authenticated;
grant insert, update, delete on public.mall_admin_memberships to authenticated;

create or replace function public.is_mall_admin_for(p_mall_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select auth.uid() is not null and (
        public.is_mall_admin()
        or exists (
            select 1
            from public.mall_admin_memberships membership
            where membership.mall_id = p_mall_id
              and membership.auth_user_id = auth.uid()
              and membership.role in ('admin', 'editor')
        )
    );
$$;

revoke all on function public.is_mall_admin_for(uuid) from public, anon;
grant execute on function public.is_mall_admin_for(uuid) to authenticated;

drop policy if exists "Users read own mall admin memberships" on public.mall_admin_memberships;
create policy "Users read own mall admin memberships"
on public.mall_admin_memberships for select to authenticated
using (auth.uid() = auth_user_id or public.is_mall_admin());

drop policy if exists "Global admins manage mall admin memberships" on public.mall_admin_memberships;
create policy "Global admins manage mall admin memberships"
on public.mall_admin_memberships for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create or replace function public.protect_mall_scope_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.mall_id is null then
        raise exception 'mall_id es obligatorio para %.', tg_table_name;
    end if;

    if tg_op = 'UPDATE'
       and old.mall_id is distinct from new.mall_id
       and not public.is_mall_admin_for(old.mall_id) then
        raise exception 'No puedes cambiar la pertenencia de un registro a otro mall.';
    end if;

    return new;
end;
$$;

revoke all on function public.protect_mall_scope_change() from public, anon, authenticated;

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'stores',
        'store_products',
        'tenant_applications',
        'mall_messages',
        'mall_editable_objects',
        'mall_object_overrides'
    ] loop
        execute format('drop trigger if exists %I on public.%I', table_name || '_mall_scope_guard', table_name);
        execute format(
            'create trigger %I before insert or update on public.%I for each row execute function public.protect_mall_scope_change()',
            table_name || '_mall_scope_guard', table_name
        );
    end loop;
end;
$$;

-- These tables previously had permissive policies. Rebuild only the policies
-- whose ownership is now explicit; public catalog reads remain available.
do $$
declare
    policy_row record;
begin
    for policy_row in
        select tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = any (array[
              'tenant_applications',
              'stores',
              'store_products',
              'mall_messages',
              'physical_spaces',
              'store_physical_links',
              'mall_editable_objects',
              'mall_object_overrides'
          ])
    loop
        execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
    end loop;
end;
$$;

alter table public.tenant_applications enable row level security;
create policy "Public submits scoped pending applications"
on public.tenant_applications for insert to anon, authenticated
with check (
    mall_id is not null
    and lower(coalesce(status, 'pending')) = 'pending'
    and (applicant_auth_user_id is null or applicant_auth_user_id = auth.uid())
);
create policy "Mall admins manage scoped applications"
on public.tenant_applications for all to authenticated
using (public.is_mall_admin_for(mall_id))
with check (public.is_mall_admin_for(mall_id));

alter table public.stores enable row level security;
create policy "Public reads scoped store catalog"
on public.stores for select to anon, authenticated
using (mall_id is not null);
create policy "Owners and mall admins update scoped stores"
on public.stores for update to authenticated
using (mall_id is not null and (owner_id = auth.uid() or public.is_mall_admin_for(mall_id)))
with check (mall_id is not null and (owner_id = auth.uid() or public.is_mall_admin_for(mall_id)));

alter table public.store_products enable row level security;
create policy "Public reads scoped products"
on public.store_products for select to anon, authenticated
using (mall_id is not null);
create policy "Owners and mall admins manage scoped products"
on public.store_products for all to authenticated
using (
    mall_id is not null
    and (
        public.is_mall_admin_for(mall_id)
        or exists (
            select 1
            from public.stores store_row
            where store_row.mall_id = store_products.mall_id
              and (
                  store_row.local_code = store_products.local_code
                  or store_row.id::text = coalesce(store_products.store_id, store_products.local_code)
              )
              and store_row.owner_id = auth.uid()
        )
    )
)
with check (
    mall_id is not null
    and (
        public.is_mall_admin_for(mall_id)
        or exists (
            select 1
            from public.stores store_row
            where store_row.mall_id = store_products.mall_id
              and (
                  store_row.local_code = store_products.local_code
                  or store_row.id::text = coalesce(store_products.store_id, store_products.local_code)
              )
              and store_row.owner_id = auth.uid()
        )
    )
);

alter table public.physical_spaces enable row level security;
create policy "Mall admins manage scoped physical spaces"
on public.physical_spaces for all to authenticated
using (mall_id is not null and public.is_mall_admin_for(mall_id))
with check (mall_id is not null and public.is_mall_admin_for(mall_id));

alter table public.store_physical_links enable row level security;
create policy "Mall admins manage scoped physical links"
on public.store_physical_links for all to authenticated
using (mall_id is not null and public.is_mall_admin_for(mall_id))
with check (mall_id is not null and public.is_mall_admin_for(mall_id));

alter table public.mall_editable_objects enable row level security;
create policy "Public reads scoped editable objects"
on public.mall_editable_objects for select to anon, authenticated
using (mall_id is not null);
create policy "Mall admins manage scoped editable objects"
on public.mall_editable_objects for all to authenticated
using (mall_id is not null and public.is_mall_admin_for(mall_id))
with check (mall_id is not null and public.is_mall_admin_for(mall_id) and structural_critical = false);

alter table public.mall_object_overrides enable row level security;
create policy "Public reads scoped object overrides"
on public.mall_object_overrides for select to anon, authenticated
using (mall_id is not null);
create policy "Mall admins manage scoped object overrides"
on public.mall_object_overrides for all to authenticated
using (mall_id is not null and public.is_mall_admin_for(mall_id))
with check (mall_id is not null and public.is_mall_admin_for(mall_id) and updated_by = auth.uid());

alter table public.mall_messages enable row level security;
create policy "Public sends scoped mall messages"
on public.mall_messages for insert to anon, authenticated
with check (
    mall_id is not null
    and (requester_member_id is null or requester_member_id = auth.uid())
);
create policy "Owners and mall admins read scoped mall messages"
on public.mall_messages for select to authenticated
using (
    mall_id is not null
    and (
        public.is_mall_admin_for(mall_id)
        or exists (
            select 1
            from public.stores store_row
            where store_row.mall_id = mall_messages.mall_id
              and (
                  store_row.id = mall_messages.store_id
                  or store_row.local_code = mall_messages.local_code
                  or store_row.id::text = mall_messages.local_code
              )
              and store_row.owner_id = auth.uid()
        )
    )
);

grant select on public.stores, public.store_products,
    public.mall_editable_objects, public.mall_object_overrides to anon, authenticated;
grant insert on public.tenant_applications to anon, authenticated;
grant select, update on public.tenant_applications to authenticated;
grant insert on public.mall_messages to anon, authenticated;
grant select on public.mall_messages to authenticated;
grant all on public.physical_spaces, public.store_physical_links to authenticated;
grant insert, update, delete on public.mall_editable_objects, public.mall_object_overrides to authenticated;

commit;
