begin;

alter table public.physical_spaces
    add column if not exists teleport_x numeric(10,2),
    add column if not exists teleport_y numeric(10,2),
    add column if not exists teleport_z numeric(10,2),
    add column if not exists teleport_target_x numeric(10,2),
    add column if not exists teleport_target_y numeric(10,2),
    add column if not exists teleport_target_z numeric(10,2),
    add column if not exists teleport_notes text;

comment on column public.physical_spaces.teleport_x is 'Coordenada X donde se estaciona al visitante frente a este espacio fisico.';
comment on column public.physical_spaces.teleport_y is 'Coordenada Y de camara/altura al estacionar al visitante frente a este espacio fisico.';
comment on column public.physical_spaces.teleport_z is 'Coordenada Z donde se estaciona al visitante frente a este espacio fisico.';
comment on column public.physical_spaces.teleport_target_x is 'Coordenada X del punto hacia donde mira la camara despues del teletransporte.';
comment on column public.physical_spaces.teleport_target_y is 'Coordenada Y del punto hacia donde mira la camara despues del teletransporte.';
comment on column public.physical_spaces.teleport_target_z is 'Coordenada Z del punto hacia donde mira la camara despues del teletransporte.';
comment on column public.physical_spaces.teleport_notes is 'Notas administrativas sobre el punto de llegada del visitante.';

create index if not exists physical_spaces_teleport_display_idx
on public.physical_spaces (display_code)
where teleport_x is not null;

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
        ps.teleport_x as camera_x,
        ps.teleport_y as camera_y,
        ps.teleport_z as camera_z,
        ps.teleport_target_x as look_x,
        ps.teleport_target_y as look_y,
        ps.teleport_target_z as look_z
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

commit;
