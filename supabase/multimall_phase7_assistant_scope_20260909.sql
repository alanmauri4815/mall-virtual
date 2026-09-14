-- Septima fase multimall: asistente, configuracion y reclamos por mall.
-- Ejecutar despues de multimall_phase2_access_20260908.sql.

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
end;
$$;

update public.mall_assistant_settings
set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781'
where mall_id is null;
update public.mall_feedback
set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781'
where mall_id is null;

alter table public.mall_assistant_settings
    alter column mall_id set not null;
alter table public.mall_feedback
    alter column mall_id set not null;

-- id sigue identificando la configuracion dentro de cada mall.
alter table public.mall_assistant_settings
    drop constraint if exists mall_assistant_settings_pkey;
alter table public.mall_assistant_settings
    add constraint mall_assistant_settings_pkey primary key (mall_id, id);

-- Primero se quita el CHECK historico, que solo permitia scope_id = 'mall'.
alter table public.mall_assistant_sessions
    drop constraint if exists mall_assistant_sessions_scope_id_check;
alter table public.mall_assistant_usage
    drop constraint if exists mall_assistant_usage_scope_id_check;
alter table public.mall_assistant_rate_limits
    drop constraint if exists mall_assistant_rate_limits_scope_id_check;
alter table public.mall_assistant_answer_cache
    drop constraint if exists mall_assistant_answer_cache_scope_id_check;

-- Las tablas internas conservan scope_id como clave tecnica, ahora derivada del mall.
update public.mall_assistant_sessions
set scope_id = 'mall:713c1740-0621-4fd7-98e6-fac2a93e4781'
where scope_id = 'mall';
update public.mall_assistant_usage
set scope_id = 'mall:713c1740-0621-4fd7-98e6-fac2a93e4781'
where scope_id = 'mall';
update public.mall_assistant_rate_limits
set scope_id = 'mall:713c1740-0621-4fd7-98e6-fac2a93e4781'
where scope_id = 'mall';
update public.mall_assistant_answer_cache
set scope_id = 'mall:713c1740-0621-4fd7-98e6-fac2a93e4781'
where scope_id = 'mall';

alter table public.mall_assistant_sessions
    add constraint mall_assistant_sessions_scope_id_check check (scope_id like 'mall:%');
alter table public.mall_assistant_usage
    add constraint mall_assistant_usage_scope_id_check check (scope_id like 'mall:%');
alter table public.mall_assistant_rate_limits
    add constraint mall_assistant_rate_limits_scope_id_check check (scope_id like 'mall:%');
alter table public.mall_assistant_answer_cache
    add constraint mall_assistant_answer_cache_scope_id_check check (scope_id like 'mall:%');

create index if not exists mall_assistant_settings_mall_id_idx
    on public.mall_assistant_settings (mall_id);
create index if not exists mall_feedback_mall_created_idx
    on public.mall_feedback (mall_id, created_at desc);

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'mall_assistant_settings',
        'mall_feedback'
    ] loop
        execute format('drop trigger if exists %I on public.%I', table_name || '_mall_scope_guard', table_name);
        execute format(
            'create trigger %I before insert or update on public.%I for each row execute function public.protect_mall_scope_change()',
            table_name || '_mall_scope_guard', table_name
        );
    end loop;
end;
$$;

drop policy if exists "Public reads enabled mall assistant" on public.mall_assistant_settings;
drop policy if exists "Public reads mall assistant configuration" on public.mall_assistant_settings;
drop policy if exists "Admins manage mall assistant" on public.mall_assistant_settings;
drop policy if exists "Mall admins read scoped assistant configuration" on public.mall_assistant_settings;
drop policy if exists "Mall admins manage scoped assistant configuration" on public.mall_assistant_settings;
create policy "Public reads scoped assistant configuration"
on public.mall_assistant_settings for select
to anon, authenticated
using (mall_id is not null);
create policy "Mall admins manage scoped assistant configuration"
on public.mall_assistant_settings for all
to authenticated
using (public.is_mall_admin_for(mall_id))
with check (public.is_mall_admin_for(mall_id));

drop policy if exists "Admins read mall feedback" on public.mall_feedback;
drop policy if exists "Admins update mall feedback" on public.mall_feedback;
drop policy if exists "Mall admins read scoped feedback" on public.mall_feedback;
drop policy if exists "Mall admins update scoped feedback" on public.mall_feedback;
create policy "Mall admins read scoped feedback"
on public.mall_feedback for select
to authenticated
using (public.is_mall_admin_for(mall_id));
create policy "Mall admins update scoped feedback"
on public.mall_feedback for update
to authenticated
using (public.is_mall_admin_for(mall_id))
with check (public.is_mall_admin_for(mall_id));

-- Se reemplaza la firma anterior para que cada reclamo quede asociado al mall.
drop function if exists public.submit_mall_feedback(text, text, text, text, text, text, boolean);
create or replace function public.submit_mall_feedback(
    p_mall_id uuid,
    p_session_key text,
    p_category text,
    p_visitor_name text,
    p_email text,
    p_phone text,
    p_message text,
    p_consent boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_feedback_id uuid;
    v_session_key text;
    v_category text;
    v_name text;
    v_email text;
    v_phone text;
    v_message text;
begin
    if p_mall_id is null or not exists (select 1 from public.malls where id = p_mall_id) then
        raise exception 'Mall invalido.';
    end if;
    if not coalesce(p_consent, false) then
        raise exception 'Debes autorizar el envio de tus datos.';
    end if;

    v_session_key := left(nullif(trim(coalesce(p_session_key, '')), ''), 120);
    v_category := case when p_category in ('complaint', 'suggestion') then p_category else null end;
    v_name := left(trim(coalesce(p_visitor_name, '')), 120);
    v_email := left(nullif(trim(coalesce(p_email, '')), ''), 200);
    v_phone := left(nullif(trim(coalesce(p_phone, '')), ''), 40);
    v_message := left(trim(coalesce(p_message, '')), 2000);

    if v_category is null then raise exception 'Selecciona reclamo o sugerencia.'; end if;
    if length(v_name) < 2 then raise exception 'Ingresa tu nombre.'; end if;
    if length(v_message) < 5 then raise exception 'Escribe un mensaje mas detallado.'; end if;

    if v_session_key is not null then
        select f.id into v_feedback_id
        from public.mall_feedback f
        where f.mall_id = p_mall_id
          and f.session_key = v_session_key
          and f.category = v_category
          and f.message = v_message
          and f.created_at > now() - interval '15 minutes'
        order by f.created_at desc
        limit 1;
        if v_feedback_id is not null then return v_feedback_id; end if;
    end if;

    insert into public.mall_feedback (
        mall_id, session_key, category, visitor_name, email, phone, message, consent_at
    ) values (
        p_mall_id, v_session_key, v_category, v_name, v_email, v_phone, v_message, now()
    ) returning id into v_feedback_id;

    return v_feedback_id;
end;
$$;

revoke all on function public.submit_mall_feedback(uuid, text, text, text, text, text, text, boolean) from public;
grant execute on function public.submit_mall_feedback(uuid, text, text, text, text, text, text, boolean) to anon, authenticated;

commit;
