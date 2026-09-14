-- Mall Creaciones - récords públicos del laberinto.
-- Ejecutar una vez en Supabase SQL Editor. El script es repetible.

begin;

create table if not exists public.mall_maze_records (
    id uuid primary key default gen_random_uuid(),
    player_name text not null
        check (char_length(player_name) between 1 and 40),
    elapsed_ms integer not null
        check (elapsed_ms between 1000 and 7200000),
    created_at timestamptz not null default now(),
    auth_user_id uuid references auth.users(id) on delete set null
);

create index if not exists mall_maze_records_ranking_idx
on public.mall_maze_records (elapsed_ms asc, created_at asc, id asc);

alter table public.mall_maze_records enable row level security;

-- Los visitantes no pueden leer ni escribir la tabla directamente. Las dos
-- operaciones públicas pasan por las funciones con validación explícita.
revoke all on public.mall_maze_records from public, anon, authenticated;

drop function if exists public.get_mall_maze_records(integer);

create or replace function public.get_mall_maze_records(
    p_limit integer default 10
)
returns table (
    ranking_position integer,
    player_name text,
    elapsed_ms integer,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
    declare
        requested_limit integer := coalesce(p_limit, 10);
    begin
        if requested_limit < 1 or requested_limit > 10 then
            raise exception 'El límite de récords debe estar entre 1 y 10.';
        end if;

        return query
        select
            row_number() over (order by r.elapsed_ms asc, r.created_at asc, r.id asc)::integer,
            r.player_name,
            r.elapsed_ms,
            r.created_at
        from public.mall_maze_records r
        order by r.elapsed_ms asc, r.created_at asc, r.id asc
        limit requested_limit;
    end;
$$;

drop function if exists public.submit_mall_maze_record(text, integer);

create or replace function public.submit_mall_maze_record(
    p_player_name text,
    p_elapsed_ms integer
)
returns table (
    rank integer,
    is_new_record boolean,
    total_records integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
    declare
        clean_name text := left(trim(coalesce(p_player_name, '')), 40);
        inserted_id uuid;
        calculated_rank integer;
        records_count integer;
    begin
        if clean_name = '' then
            clean_name := 'Jugador local';
        end if;

        if p_elapsed_ms is null or p_elapsed_ms < 1000 or p_elapsed_ms > 7200000 then
            raise exception 'El tiempo del recorrido no es válido.';
        end if;

        insert into public.mall_maze_records (player_name, elapsed_ms, auth_user_id)
        values (clean_name, p_elapsed_ms, auth.uid())
        returning id into inserted_id;

        select count(*)::integer
        into records_count
        from public.mall_maze_records;

        select ranked.rank::integer
        into calculated_rank
        from (
            select
                r.id,
                row_number() over (order by r.elapsed_ms asc, r.created_at asc, r.id asc) as rank
            from public.mall_maze_records r
        ) ranked
        where ranked.id = inserted_id;

        return query select
            calculated_rank,
            calculated_rank = 1,
            records_count;
    end;
$$;

revoke all on function public.get_mall_maze_records(integer) from public;
grant execute on function public.get_mall_maze_records(integer) to anon, authenticated;

revoke all on function public.submit_mall_maze_record(text, integer) from public;
grant execute on function public.submit_mall_maze_record(text, integer) to anon, authenticated;

commit;
