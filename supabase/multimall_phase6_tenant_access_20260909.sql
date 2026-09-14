-- Sexta fase multimall: arriendos, pagos y notas separados por mall.
-- Ejecutar despues de multimall_phase2_access_20260908.sql.
-- Backfill seguro para los datos existentes de Mall Providencia.

begin;

do $$
begin
    if not exists (
        select 1
        from public.malls
        where id = '713c1740-0621-4fd7-98e6-fac2a93e4781'
          and slug = 'providencia'
    ) then
        raise exception 'No existe el mall canonico de Providencia.';
    end if;

    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name in ('tenant_leases', 'tenant_payments', 'tenant_notes')
          and column_name = 'mall_id'
        group by table_schema
        having count(*) = 3
    ) then
        raise exception 'Falta mall_id en una o mas tablas de arriendos.';
    end if;
end;
$$;

update public.tenant_leases
set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781'
where mall_id is null;

update public.tenant_payments
set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781'
where mall_id is null;

update public.tenant_notes
set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781'
where mall_id is null;

alter table public.tenant_leases
    alter column mall_id set not null;
alter table public.tenant_payments
    alter column mall_id set not null;
alter table public.tenant_notes
    alter column mall_id set not null;

create index if not exists tenant_leases_mall_store_idx
    on public.tenant_leases (mall_id, store_id, created_at desc);
create index if not exists tenant_payments_mall_store_idx
    on public.tenant_payments (mall_id, store_id, due_date desc);
create index if not exists tenant_notes_mall_store_idx
    on public.tenant_notes (mall_id, store_id, created_at desc);

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'tenant_leases',
        'tenant_payments',
        'tenant_notes'
    ] loop
        execute format('drop trigger if exists %I on public.%I', table_name || '_mall_scope_guard', table_name);
        execute format(
            'create trigger %I before insert or update on public.%I for each row execute function public.protect_mall_scope_change()',
            table_name || '_mall_scope_guard', table_name
        );
    end loop;
end;
$$;

drop policy if exists "Admins manage leases" on public.tenant_leases;
drop policy if exists "Admins manage tenant leases" on public.tenant_leases;
drop policy if exists "Owners read own leases" on public.tenant_leases;
drop policy if exists "Tenants read own leases" on public.tenant_leases;
drop policy if exists "Mall admins manage scoped leases" on public.tenant_leases;
drop policy if exists "Tenants read scoped leases" on public.tenant_leases;
create policy "Mall admins manage scoped leases"
on public.tenant_leases for all to authenticated
using (public.is_mall_admin_for(mall_id))
with check (public.is_mall_admin_for(mall_id));
create policy "Tenants read scoped leases"
on public.tenant_leases for select to authenticated
using (
    public.is_mall_admin_for(mall_id)
    or tenant_auth_user_id = auth.uid()
    or exists (
        select 1
        from public.stores s
        where s.mall_id = tenant_leases.mall_id
          and s.id = tenant_leases.store_id
          and s.owner_id = auth.uid()
    )
);

drop policy if exists "Admins manage payments" on public.tenant_payments;
drop policy if exists "Admins manage tenant payments" on public.tenant_payments;
drop policy if exists "Owners read own payments" on public.tenant_payments;
drop policy if exists "Tenants read own payments" on public.tenant_payments;
drop policy if exists "Mall admins manage scoped payments" on public.tenant_payments;
drop policy if exists "Tenants read scoped payments" on public.tenant_payments;
create policy "Mall admins manage scoped payments"
on public.tenant_payments for all to authenticated
using (public.is_mall_admin_for(mall_id))
with check (public.is_mall_admin_for(mall_id));
create policy "Tenants read scoped payments"
on public.tenant_payments for select to authenticated
using (
    public.is_mall_admin_for(mall_id)
    or tenant_auth_user_id = auth.uid()
    or exists (
        select 1
        from public.stores s
        where s.mall_id = tenant_payments.mall_id
          and s.id = tenant_payments.store_id
          and s.owner_id = auth.uid()
    )
);

drop policy if exists "Admins manage notes" on public.tenant_notes;
drop policy if exists "Admins manage tenant notes" on public.tenant_notes;
drop policy if exists "Owners read visible notes" on public.tenant_notes;
drop policy if exists "Tenants read visible notes" on public.tenant_notes;
drop policy if exists "Mall admins manage scoped notes" on public.tenant_notes;
drop policy if exists "Tenants read scoped notes" on public.tenant_notes;
create policy "Mall admins manage scoped notes"
on public.tenant_notes for all to authenticated
using (public.is_mall_admin_for(mall_id))
with check (public.is_mall_admin_for(mall_id));
create policy "Tenants read scoped notes"
on public.tenant_notes for select to authenticated
using (
    public.is_mall_admin_for(mall_id)
    or (
        visibility = 'tenant'
        and (
            tenant_auth_user_id = auth.uid()
            or exists (
                select 1
                from public.stores s
                where s.mall_id = tenant_notes.mall_id
                  and s.id = tenant_notes.store_id
                  and s.owner_id = auth.uid()
            )
        )
    )
);

comment on column public.tenant_leases.mall_id is
    'Mall propietario del arriendo. Obligatorio para evitar cruces entre malls.';
comment on column public.tenant_payments.mall_id is
    'Mall propietario del pago. Obligatorio para evitar cruces entre malls.';
comment on column public.tenant_notes.mall_id is
    'Mall propietario de la nota. Obligatorio para evitar cruces entre malls.';

commit;
