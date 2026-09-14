-- Ejecutar solamente despues de publicar el frontend que ya no consulta source_code.
-- Conserva una tabla de equivalencias para auditorias o recuperacion historica.
begin;

create table if not exists public.physical_space_legacy_codes_20260805 (
    physical_space_id text primary key,
    legacy_source_code text,
    archived_at timestamptz not null default now()
);

insert into public.physical_space_legacy_codes_20260805 (
    physical_space_id,
    legacy_source_code
)
select physical_space_id, source_code
from public.physical_spaces
where nullif(trim(source_code), '') is not null
on conflict (physical_space_id) do update
set legacy_source_code = excluded.legacy_source_code;

alter table public.physical_space_legacy_codes_20260805 enable row level security;

drop function if exists public.get_physical_space_teleport_points();

create function public.get_physical_space_teleport_points()
returns table (
    physical_space_id text,
    display_code text,
    floor_label text,
    camera_x numeric,
    camera_y numeric,
    camera_z numeric,
    look_x numeric,
    look_y numeric,
    look_z numeric
)
language sql
stable
security definer
set search_path = public
as $$
    select
        ps.physical_space_id,
        ps.display_code,
        ps.floor_label,
        ps.teleport_x,
        ps.teleport_y,
        ps.teleport_z,
        ps.teleport_target_x,
        ps.teleport_target_y,
        ps.teleport_target_z
    from public.physical_spaces ps
    where ps.teleport_x is not null
      and ps.teleport_y is not null
      and ps.teleport_z is not null
      and ps.teleport_target_x is not null
      and ps.teleport_target_y is not null
      and ps.teleport_target_z is not null;
$$;

revoke all on function public.get_physical_space_teleport_points() from public;
grant execute on function public.get_physical_space_teleport_points() to anon, authenticated;

drop index if exists public.physical_spaces_source_code_idx;
alter table public.physical_spaces drop column source_code;

comment on table public.physical_space_legacy_codes_20260805 is
    'Respaldo historico del identificador source_code retirado de physical_spaces.';

commit;
