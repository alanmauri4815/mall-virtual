begin;

create table if not exists public.mall_editable_objects (
    object_id text primary key,
    object_type text not null check (object_type in ('wall', 'furniture', 'bench')),
    area_code text,
    label text not null,
    editable boolean not null default true,
    structural_critical boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.mall_object_overrides (
    object_id text primary key references public.mall_editable_objects(object_id) on delete cascade,
    position_x double precision not null,
    position_y double precision not null,
    position_z double precision not null,
    rotation_x double precision not null default 0,
    rotation_y double precision not null default 0,
    rotation_z double precision not null default 0,
    scale_x double precision not null default 1,
    scale_y double precision not null default 1,
    scale_z double precision not null default 1,
    visible boolean not null default true,
    collision_enabled boolean not null default true,
    updated_by uuid references auth.users(id),
    updated_at timestamptz not null default now()
);

alter table public.mall_editable_objects enable row level security;
alter table public.mall_object_overrides enable row level security;

drop policy if exists "mall editable objects public read" on public.mall_editable_objects;
create policy "mall editable objects public read" on public.mall_editable_objects for select using (true);
drop policy if exists "mall editable objects admin write" on public.mall_editable_objects;
create policy "mall editable objects admin write" on public.mall_editable_objects for all
using (public.is_mall_admin())
with check (public.is_mall_admin() and structural_critical = false);

drop policy if exists "mall object overrides public read" on public.mall_object_overrides;
create policy "mall object overrides public read" on public.mall_object_overrides for select using (true);
drop policy if exists "mall object overrides admin write" on public.mall_object_overrides;
create policy "mall object overrides admin write" on public.mall_object_overrides for all
using (public.is_mall_admin())
with check (public.is_mall_admin() and updated_by = auth.uid());

grant select on public.mall_editable_objects, public.mall_object_overrides to anon, authenticated;
grant insert, update, delete on public.mall_editable_objects, public.mall_object_overrides to authenticated;

commit;
