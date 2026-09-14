-- Primera fase multimall: asociar datos existentes al mall de Providencia.
-- Es aditiva e idempotente. No crea valores por defecto para escrituras futuras.

begin;

do $$
begin
    if not exists (
        select 1
        from public.malls
        where id = '713c1740-0621-4fd7-98e6-fac2a93e4781'
          and slug = 'providencia'
    ) then
        raise exception 'No existe el registro canonico del mall Providencia.';
    end if;
end;
$$;

alter table public.stores add column if not exists mall_id uuid references public.malls(id);
alter table public.store_products add column if not exists mall_id uuid references public.malls(id);
alter table public.physical_spaces add column if not exists mall_id uuid references public.malls(id);
alter table public.store_physical_links add column if not exists mall_id uuid references public.malls(id);
alter table public.mall_editable_objects add column if not exists mall_id uuid references public.malls(id);
alter table public.mall_object_overrides add column if not exists mall_id uuid references public.malls(id);
alter table public.mall_promotions add column if not exists mall_id uuid references public.malls(id);
alter table public.mall_promotion_codes add column if not exists mall_id uuid references public.malls(id);
alter table public.mall_promotion_claims add column if not exists mall_id uuid references public.malls(id);
alter table public.member_monthly_activity add column if not exists mall_id uuid references public.malls(id);
alter table public.analytics_sessions add column if not exists mall_id uuid references public.malls(id);
alter table public.analytics_events add column if not exists mall_id uuid references public.malls(id);
alter table public.mall_maze_records add column if not exists mall_id uuid references public.malls(id);
alter table public.mall_maze_runs add column if not exists mall_id uuid references public.malls(id);
alter table public.mall_assistant_settings add column if not exists mall_id uuid references public.malls(id);
alter table public.mall_feedback add column if not exists mall_id uuid references public.malls(id);
alter table public.tenant_applications add column if not exists mall_id uuid references public.malls(id);
alter table public.tenant_leases add column if not exists mall_id uuid references public.malls(id);
alter table public.tenant_payments add column if not exists mall_id uuid references public.malls(id);
alter table public.tenant_notes add column if not exists mall_id uuid references public.malls(id);
alter table public.mall_messages add column if not exists mall_id uuid references public.malls(id);

update public.stores set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.store_products set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.physical_spaces set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.store_physical_links set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.mall_editable_objects set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.mall_object_overrides set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.mall_promotions set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.mall_promotion_codes set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.mall_promotion_claims set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.member_monthly_activity set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.analytics_sessions set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.analytics_events set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.mall_maze_records set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.mall_maze_runs set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.mall_assistant_settings set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.mall_feedback set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.tenant_applications set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.tenant_leases set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.tenant_payments set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.tenant_notes set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;
update public.mall_messages set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781' where mall_id is null;

create index if not exists stores_mall_id_idx on public.stores (mall_id);
create index if not exists store_products_mall_id_idx on public.store_products (mall_id);
create index if not exists physical_spaces_mall_id_idx on public.physical_spaces (mall_id);
create index if not exists store_physical_links_mall_id_idx on public.store_physical_links (mall_id);
create index if not exists mall_editable_objects_mall_id_idx on public.mall_editable_objects (mall_id);
create index if not exists mall_object_overrides_mall_id_idx on public.mall_object_overrides (mall_id);
create index if not exists mall_promotions_mall_id_idx on public.mall_promotions (mall_id);
create index if not exists mall_promotion_codes_mall_id_idx on public.mall_promotion_codes (mall_id);
create index if not exists mall_promotion_claims_mall_id_idx on public.mall_promotion_claims (mall_id);
create index if not exists member_monthly_activity_mall_id_idx on public.member_monthly_activity (mall_id);
create index if not exists analytics_sessions_mall_id_idx on public.analytics_sessions (mall_id);
create index if not exists analytics_events_mall_id_idx on public.analytics_events (mall_id);
create index if not exists mall_maze_records_mall_id_idx on public.mall_maze_records (mall_id);
create index if not exists mall_maze_runs_mall_id_idx on public.mall_maze_runs (mall_id);
create index if not exists mall_assistant_settings_mall_id_idx on public.mall_assistant_settings (mall_id);
create index if not exists mall_feedback_mall_id_idx on public.mall_feedback (mall_id);
create index if not exists tenant_applications_mall_id_idx on public.tenant_applications (mall_id);
create index if not exists tenant_leases_mall_id_idx on public.tenant_leases (mall_id);
create index if not exists tenant_payments_mall_id_idx on public.tenant_payments (mall_id);
create index if not exists tenant_notes_mall_id_idx on public.tenant_notes (mall_id);
create index if not exists mall_messages_mall_id_idx on public.mall_messages (mall_id);

comment on column public.stores.mall_id is 'Mall propietario del local. Sin default para evitar asignaciones silenciosas.';
comment on column public.physical_spaces.mall_id is 'Instancia del espacio fisico dentro de un mall; la geometria se replica por mall.';
comment on column public.mall_editable_objects.mall_id is 'Mall propietario del objeto editable y sus transformaciones.';

commit;
