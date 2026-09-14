-- Retira el identificador geometrico legado y corrige el destino de SE-10.
-- Ejecutar completo una sola vez en Supabase > SQL Editor.
begin;

create table if not exists public.physical_space_legacy_codes_20260805 (
    physical_space_id text primary key,
    legacy_source_code text,
    archived_at timestamptz not null default now()
);

alter table public.physical_space_legacy_codes_20260805 enable row level security;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'physical_spaces'
          and column_name = 'source_code'
    ) then
        execute $archive$
            insert into public.physical_space_legacy_codes_20260805 (
                physical_space_id,
                legacy_source_code
            )
            select physical_space_id, source_code
            from public.physical_spaces
            where nullif(trim(source_code), '') is not null
            on conflict (physical_space_id) do update
            set legacy_source_code = excluded.legacy_source_code
        $archive$;
    end if;
end;
$$;

-- Este paño pertenece a SE-10 (x negativo). Conservaba por error la cámara
-- del paño horizontal de OS-10 (x positivo).
update public.physical_spaces
set
    display_code = 'SE-10',
    teleport_x = -23.00,
    teleport_y = 1.80,
    teleport_z = -10.00,
    teleport_target_x = -23.00,
    teleport_target_y = 1.80,
    teleport_target_z = -18.00,
    updated_at = now()
where physical_space_id = 'phys_b_f1_xn_zn_horizontal_01';

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
alter table public.physical_spaces drop column if exists source_code;

comment on table public.physical_space_legacy_codes_20260805 is
    'Respaldo historico del identificador source_code retirado de physical_spaces.';

commit;

select
    physical_space_id,
    display_code,
    floor_label,
    teleport_x,
    teleport_y,
    teleport_z,
    teleport_target_x,
    teleport_target_y,
    teleport_target_z
from public.physical_spaces
where display_code in ('SE-10', 'OS-10')
order by display_code, physical_space_id;
