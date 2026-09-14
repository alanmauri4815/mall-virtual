-- Mall Creaciones - validacion server-side del recorrido del laberinto.
-- Ejecutar despues de maze_records_20260905.sql.

begin;

create table if not exists public.mall_maze_runs (
    id uuid primary key default gen_random_uuid(),
    player_name text not null
        check (char_length(player_name) between 1 and 40),
    maze_version text not null
        check (char_length(maze_version) between 1 and 40),
    checkpoint_count integer not null
        check (checkpoint_count between 1 and 20),
    last_checkpoint integer not null default 0
        check (last_checkpoint between 0 and checkpoint_count),
    status text not null default 'active'
        check (status in ('active', 'completed', 'abandoned')),
    auth_user_id uuid references auth.users(id) on delete set null,
    started_at timestamptz not null default now(),
    last_checkpoint_at timestamptz,
    completed_at timestamptz
);

alter table public.mall_maze_records
    add column if not exists run_id uuid;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'mall_maze_records_run_id_fkey'
          and conrelid = 'public.mall_maze_records'::regclass
    ) then
        alter table public.mall_maze_records
            add constraint mall_maze_records_run_id_fkey
            foreign key (run_id) references public.mall_maze_runs(id) on delete set null;
    end if;
end;
$$;

create unique index if not exists mall_maze_records_run_id_idx
on public.mall_maze_records (run_id)
where run_id is not null;

create index if not exists mall_maze_runs_status_time_idx
on public.mall_maze_runs (status, started_at desc);

alter table public.mall_maze_runs enable row level security;
revoke all on public.mall_maze_runs from public, anon, authenticated;

-- Invalida la RPC antigua que permitia registrar un tiempo sin una partida
-- validada. Los clientes actualizados usan submit_mall_maze_record_v2.
do $$
begin
    if to_regprocedure('public.submit_mall_maze_record(text,integer)') is not null then
        revoke all on function public.submit_mall_maze_record(text, integer)
            from public, anon, authenticated;
    end if;
end;
$$;

create or replace function public.start_mall_maze_run(
    p_player_name text,
    p_maze_version text,
    p_checkpoint_count integer
)
returns table (
    run_id uuid,
    started_at timestamptz,
    checkpoint_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    clean_name text := left(trim(coalesce(p_player_name, '')), 40);
    new_run_id uuid;
    server_started_at timestamptz := clock_timestamp();
begin
    if clean_name = '' then
        clean_name := 'Jugador local';
    end if;

    if p_maze_version <> 'north-west-v2' or p_checkpoint_count <> 5 then
        raise exception 'Version de laberinto no valida.';
    end if;

    insert into public.mall_maze_runs (
        player_name, maze_version, checkpoint_count, auth_user_id, started_at
    ) values (
        clean_name, p_maze_version, p_checkpoint_count, auth.uid(), server_started_at
    ) returning id into new_run_id;

    return query select new_run_id, server_started_at, p_checkpoint_count;
end;
$$;

create or replace function public.record_mall_maze_checkpoint(
    p_run_id uuid,
    p_checkpoint integer,
    p_elapsed_ms integer
)
returns table (
    accepted boolean,
    next_checkpoint integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    current_run public.mall_maze_runs%rowtype;
    server_elapsed_ms integer;
begin
    select *
    into current_run
    from public.mall_maze_runs
    where id = p_run_id
    for update;

    if not found
       or current_run.auth_user_id is distinct from auth.uid()
       or current_run.status <> 'active'
       or p_checkpoint <> current_run.last_checkpoint + 1
       or p_checkpoint > current_run.checkpoint_count
       or p_elapsed_ms is null
       or p_elapsed_ms < 0
       or p_elapsed_ms > 7200000 then
        return query select false, coalesce(current_run.last_checkpoint, 0);
        return;
    end if;

    server_elapsed_ms := floor(extract(epoch from (clock_timestamp() - current_run.started_at)) * 1000);
    if p_elapsed_ms + 5000 < server_elapsed_ms then
        return query select false, current_run.last_checkpoint;
        return;
    end if;

    update public.mall_maze_runs
    set last_checkpoint = p_checkpoint,
        last_checkpoint_at = clock_timestamp()
    where id = p_run_id;

    return query select true, p_checkpoint;
end;
$$;

create or replace function public.submit_mall_maze_record_v2(
    p_run_id uuid,
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
    current_run public.mall_maze_runs%rowtype;
    clean_name text := left(trim(coalesce(p_player_name, '')), 40);
    inserted_id uuid;
    calculated_rank integer;
    records_count integer;
    server_elapsed_ms integer;
begin
    select *
    into current_run
    from public.mall_maze_runs
    where id = p_run_id
    for update;

    if not found or current_run.auth_user_id is distinct from auth.uid() then
        raise exception 'Partida no encontrada.';
    end if;
    if current_run.status <> 'active' then
        raise exception 'La partida ya fue cerrada.';
    end if;
    if current_run.last_checkpoint < current_run.checkpoint_count then
        raise exception 'Debes completar todos los puntos de control.';
    end if;
    if p_elapsed_ms is null or p_elapsed_ms < 1000 or p_elapsed_ms > 7200000 then
        raise exception 'El tiempo del recorrido no es valido.';
    end if;

    server_elapsed_ms := floor(extract(epoch from (clock_timestamp() - current_run.started_at)) * 1000);
    if p_elapsed_ms + 5000 < server_elapsed_ms then
        raise exception 'El tiempo informado no coincide con la partida.';
    end if;

    if clean_name = '' then
        clean_name := current_run.player_name;
    end if;

    update public.mall_maze_runs
    set player_name = clean_name,
        status = 'completed',
        completed_at = clock_timestamp()
    where id = p_run_id;

    insert into public.mall_maze_records (
        run_id, player_name, elapsed_ms, auth_user_id
    ) values (
        p_run_id, clean_name, p_elapsed_ms, auth.uid()
    ) returning id into inserted_id;

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

    return query select calculated_rank, calculated_rank = 1, records_count;
end;
$$;

revoke all on function public.start_mall_maze_run(text, text, integer) from public;
grant execute on function public.start_mall_maze_run(text, text, integer) to anon, authenticated;

revoke all on function public.record_mall_maze_checkpoint(uuid, integer, integer) from public;
grant execute on function public.record_mall_maze_checkpoint(uuid, integer, integer) to anon, authenticated;

revoke all on function public.submit_mall_maze_record_v2(uuid, text, integer) from public;
grant execute on function public.submit_mall_maze_record_v2(uuid, text, integer) to anon, authenticated;

commit;
