-- Centro de Operaciones del Mall.
-- Ejecutar una vez en Supabase SQL Editor despues de las migraciones multimall.
-- Registra actividad agregada, sin guardar el contenido de las preguntas ni rutas exactas.

begin;

-- Amplia el contrato de eventos sin depender del nombre que Postgres asigno a la
-- restriccion en instalaciones anteriores.
do $$
declare
    constraint_name text;
begin
    for constraint_name in
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'analytics_events'
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) ilike '%event_name%'
    loop
        execute format('alter table public.analytics_events drop constraint %I', constraint_name);
    end loop;
end;
$$;

alter table public.analytics_events
    add constraint analytics_events_event_name_check check (event_name in (
        'session_started', 'mall_entered', 'search_opened', 'search_submitted',
        'search_result_clicked', 'route_requested', 'store_attention_qualified',
        'store_attention_ended', 'store_opened', 'product_viewed', 'contact_clicked',
        'message_sent', 'login_succeeded', 'zone_entered', 'maze_started',
        'maze_completed', 'maze_exited', 'assistant_question_sent', 'feedback_submitted'
    ));

create index if not exists analytics_events_mall_event_time_idx
    on public.analytics_events (mall_id, event_name, occurred_at desc);

create or replace function public.record_analytics_event(
    p_client_event_id uuid,
    p_session_id uuid,
    p_event_name text,
    p_store_code text default null,
    p_product_id text default null,
    p_search_term text default null,
    p_channel text default null,
    p_source text default null,
    p_item_label text default null,
    p_duration_ms integer default null,
    p_result_count integer default null,
    p_device_class text default 'desktop',
    p_mall_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    resolved_store_id text;
    resolved_local_code text;
    resolved_product_id text;
    resolved_role text := 'guest';
    clean_event_name text := lower(trim(coalesce(p_event_name, '')));
    clean_search_term text;
    clean_channel text;
    clean_source text;
    clean_item_label text;
    clean_device_class text := lower(trim(coalesce(p_device_class, 'desktop')));
    clean_duration_ms integer;
    clean_result_count integer;
begin
    if p_client_event_id is null or p_session_id is null or p_mall_id is null then return false; end if;
    if not exists (select 1 from public.malls where id = p_mall_id) then return false; end if;
    if exists (
        select 1 from public.analytics_sessions s
        where s.id = p_session_id and s.mall_id is distinct from p_mall_id
    ) then return false; end if;

    if clean_event_name not in (
        'session_started', 'mall_entered', 'search_opened', 'search_submitted',
        'search_result_clicked', 'route_requested', 'store_attention_qualified',
        'store_attention_ended', 'store_opened', 'product_viewed', 'contact_clicked',
        'message_sent', 'login_succeeded', 'zone_entered', 'maze_started',
        'maze_completed', 'maze_exited', 'assistant_question_sent', 'feedback_submitted'
    ) then return false; end if;

    if clean_device_class not in ('mobile', 'tablet', 'desktop') then clean_device_class := 'desktop'; end if;
    if auth.uid() is not null then
        resolved_role := 'authenticated';
        if public.is_mall_admin_for(p_mall_id) then
            resolved_role := 'admin';
        elsif exists (select 1 from public.stores s where s.owner_id = auth.uid() and s.mall_id = p_mall_id) then
            resolved_role := 'tenant';
        elsif exists (select 1 from public.mall_members mm where mm.auth_user_id = auth.uid()) then
            resolved_role := 'member';
        end if;
    end if;

    if (select count(*) from public.analytics_events e
        where e.session_id = p_session_id and e.mall_id = p_mall_id
          and e.occurred_at >= now() - interval '1 minute') >= 90 then return false; end if;

    if nullif(trim(coalesce(p_store_code, '')), '') is not null then
        select s.id, s.local_code into resolved_store_id, resolved_local_code
        from public.stores s
        where s.mall_id = p_mall_id and (
            upper(replace(trim(s.id::text), '-', '')) = upper(replace(trim(p_store_code), '-', ''))
            or upper(replace(trim(s.local_code), '-', '')) = upper(replace(trim(p_store_code), '-', ''))
        )
        order by case when upper(replace(trim(s.local_code), '-', '')) = upper(replace(trim(p_store_code), '-', '')) then 0 else 1 end
        limit 1;
    end if;

    if p_product_id is not null and exists (
        select 1 from public.store_products sp
        where sp.mall_id = p_mall_id and sp.id::text = p_product_id
          and (resolved_store_id is null or upper(replace(trim(coalesce(sp.local_code, '')), '-', '')) = upper(replace(trim(coalesce(resolved_local_code, '')), '-', '')))
    ) then resolved_product_id := p_product_id; end if;

    clean_search_term := left(regexp_replace(lower(trim(coalesce(p_search_term, ''))), '\\s+', ' ', 'g'), 80);
    if clean_search_term = '' or clean_search_term like '%@%' or clean_search_term ~ '(\\+?[0-9][[:space:]().-]*){7,}' then clean_search_term := null; end if;
    clean_channel := nullif(left(lower(trim(coalesce(p_channel, ''))), 24), '');
    if clean_channel is not null and clean_channel not in ('email', 'whatsapp', 'telegram', 'form', 'social', 'catalog', 'map') then clean_channel := null; end if;
    clean_source := nullif(left(lower(trim(coalesce(p_source, ''))), 40), '');
    clean_item_label := nullif(left(trim(coalesce(p_item_label, '')), 120), '');
    clean_duration_ms := case when p_duration_ms is null then null else least(600000, greatest(0, p_duration_ms)) end;
    clean_result_count := case when p_result_count is null then null else least(500, greatest(0, p_result_count)) end;

    insert into public.analytics_sessions (id, mall_id, auth_user_id, visitor_role, device_class, started_at, last_seen_at)
    values (p_session_id, p_mall_id, auth.uid(), resolved_role, clean_device_class, now(), now())
    on conflict (id) do update set
        mall_id = excluded.mall_id,
        auth_user_id = coalesce(excluded.auth_user_id, analytics_sessions.auth_user_id),
        visitor_role = excluded.visitor_role,
        device_class = excluded.device_class,
        last_seen_at = now();

    insert into public.analytics_events (
        mall_id, client_event_id, session_id, auth_user_id, visitor_role, event_name,
        store_id, local_code, product_id, search_term, channel, source, item_label,
        duration_ms, result_count, device_class, metadata
    ) values (
        p_mall_id, p_client_event_id, p_session_id, auth.uid(), resolved_role, clean_event_name,
        resolved_store_id, resolved_local_code, resolved_product_id, clean_search_term,
        clean_channel, clean_source, clean_item_label, clean_duration_ms, clean_result_count,
        clean_device_class, jsonb_strip_nulls(jsonb_build_object(
            'duration_bucket', case when clean_duration_ms is null then null when clean_duration_ms <= 5000 then '3-5s' when clean_duration_ms <= 10000 then '6-10s' when clean_duration_ms <= 20000 then '11-20s' else '20s+' end
        ))
    ) on conflict (client_event_id) do nothing;
    return true;
end;
$$;

revoke all on function public.record_analytics_event(uuid, uuid, text, text, text, text, text, text, text, integer, integer, text, uuid) from public;
grant execute on function public.record_analytics_event(uuid, uuid, text, text, text, text, text, text, text, integer, integer, text, uuid) to anon, authenticated;

-- Reemplazo multmall del tablero histórico, conservando sus métricas originales.
create or replace function public.get_mall_analytics_scoped(
    p_mall_id uuid,
    p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    days_count integer := least(90, greatest(1, coalesce(p_days, 30)));
    range_start timestamptz;
begin
    if p_mall_id is null or not public.is_mall_admin_for(p_mall_id) then
        raise exception 'No tienes permiso para ver las estadísticas de este mall.';
    end if;
    range_start := date_trunc('day', now()) - make_interval(days => days_count - 1);

    return jsonb_build_object(
        'days', days_count,
        'summary', (
            select jsonb_build_object(
                'unique_visitors', count(distinct e.session_id),
                'mall_entries', count(*) filter (where e.event_name = 'mall_entered'),
                'searches', count(*) filter (where e.event_name = 'search_submitted'),
                'searches_without_results', count(*) filter (where e.event_name = 'search_submitted' and coalesce(e.result_count, 0) = 0),
                'attention_count', count(*) filter (where e.event_name = 'store_attention_qualified'),
                'store_opens', count(*) filter (where e.event_name = 'store_opened'),
                'product_views', count(*) filter (where e.event_name = 'product_viewed'),
                'contact_actions', count(*) filter (where e.event_name in ('contact_clicked', 'message_sent')),
                'route_requests', count(*) filter (where e.event_name = 'route_requested')
            )
            from public.analytics_events e
            where e.mall_id = p_mall_id and e.occurred_at >= range_start
              and e.visitor_role in ('guest', 'member', 'authenticated')
        ),
        'daily', coalesce((
            select jsonb_agg(jsonb_build_object(
                'day', series.day::date,
                'unique_visitors', coalesce(metrics.unique_visitors, 0),
                'mall_entries', coalesce(metrics.mall_entries, 0),
                'attention', coalesce(metrics.attention, 0),
                'store_opens', coalesce(metrics.store_opens, 0),
                'contacts', coalesce(metrics.contacts, 0)
            ) order by series.day)
            from generate_series(
                date_trunc('day', now()) - make_interval(days => days_count - 1),
                date_trunc('day', now()), interval '1 day'
            ) as series(day)
            left join lateral (
                select count(distinct e.session_id) as unique_visitors,
                    count(*) filter (where e.event_name = 'mall_entered') as mall_entries,
                    count(*) filter (where e.event_name = 'store_attention_qualified') as attention,
                    count(*) filter (where e.event_name = 'store_opened') as store_opens,
                    count(*) filter (where e.event_name in ('contact_clicked', 'message_sent')) as contacts
                from public.analytics_events e
                where e.mall_id = p_mall_id and e.occurred_at >= series.day
                  and e.occurred_at < series.day + interval '1 day'
                  and e.visitor_role in ('guest', 'member', 'authenticated')
            ) metrics on true
        ), '[]'::jsonb),
        'top_stores', coalesce((
            select jsonb_agg(row_to_json(store_row)::jsonb order by store_row.activity_score desc, store_row.local_code)
            from (
                select s.id as store_id, s.local_code, s.name,
                    count(distinct e.session_id) as unique_visitors,
                    count(*) filter (where e.event_name = 'store_attention_qualified') as attention,
                    count(*) filter (where e.event_name = 'store_opened') as store_opens,
                    count(*) filter (where e.event_name in ('contact_clicked', 'message_sent')) as contacts,
                    count(*) filter (where e.event_name = 'store_attention_qualified')
                        + 2 * count(*) filter (where e.event_name = 'store_opened')
                        + 3 * count(*) filter (where e.event_name = 'product_viewed')
                        + 8 * count(*) filter (where e.event_name in ('contact_clicked', 'message_sent')) as activity_score
                from public.stores s join public.analytics_events e on e.store_id = s.id
                where s.mall_id = p_mall_id and e.mall_id = p_mall_id and e.occurred_at >= range_start
                  and e.visitor_role in ('guest', 'member', 'authenticated')
                group by s.id, s.local_code, s.name
                order by activity_score desc limit 10
            ) store_row
        ), '[]'::jsonb),
        'searches_without_results', coalesce((
            select jsonb_agg(row_to_json(search_row)::jsonb order by search_row.search_count desc, search_row.search_term)
            from (
                select e.search_term, count(*) as search_count
                from public.analytics_events e
                where e.mall_id = p_mall_id and e.event_name = 'search_submitted'
                  and e.result_count = 0 and e.search_term is not null and e.occurred_at >= range_start
                  and e.visitor_role in ('guest', 'member', 'authenticated')
                group by e.search_term order by count(*) desc limit 10
            ) search_row
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.get_mall_analytics_scoped(uuid, integer) from public, anon;
grant execute on function public.get_mall_analytics_scoped(uuid, integer) to authenticated;

create or replace function public.get_mall_operations_dashboard(
    p_mall_id uuid,
    p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    days_back integer := least(90, greatest(1, coalesce(p_days, 30)));
    starts_at timestamptz;
begin
    if p_mall_id is null or not public.is_mall_admin_for(p_mall_id) then
        raise exception 'No tienes permiso para ver la operación de este mall.';
    end if;
    starts_at := now() - make_interval(days => days_back);

    return jsonb_build_object(
        'days', days_back,
        'summary', (
            select jsonb_build_object(
                'active_last_15_minutes', count(*) filter (where s.last_seen_at >= now() - interval '15 minutes' and s.visitor_role in ('guest', 'member', 'authenticated')),
                'maze_started', (select count(*) from public.analytics_events e where e.mall_id = p_mall_id and e.event_name = 'maze_started' and e.occurred_at >= starts_at),
                'maze_completed', (select count(*) from public.analytics_events e where e.mall_id = p_mall_id and e.event_name = 'maze_completed' and e.occurred_at >= starts_at),
                'assistant_questions', (select count(*) from public.analytics_events e where e.mall_id = p_mall_id and e.event_name = 'assistant_question_sent' and e.occurred_at >= starts_at),
                'feedback_submitted', (select count(*) from public.mall_feedback f where f.mall_id = p_mall_id and f.created_at >= starts_at)
            ) from public.analytics_sessions s where s.mall_id = p_mall_id
        ),
        'zones', coalesce((
            select jsonb_agg(row_to_json(zone_row)::jsonb order by zone_row.visitor_count desc, zone_row.visit_count desc)
            from (
                select coalesce(e.item_label, 'Sector no identificado') as zone_name,
                       count(distinct e.session_id) as visitor_count, count(*) as visit_count
                from public.analytics_events e
                where e.mall_id = p_mall_id and e.event_name = 'zone_entered' and e.occurred_at >= starts_at
                group by e.item_label order by visitor_count desc, visit_count desc limit 8
            ) zone_row
        ), '[]'::jsonb),
        'roles', coalesce((
            select jsonb_agg(row_to_json(role_row)::jsonb order by role_row.sort_order)
            from (
                select case
                    when s.visitor_role = 'admin' then 'Administrador'
                    when s.visitor_role = 'tenant' then 'Locatario'
                    when s.visitor_role in ('member', 'authenticated') then 'Visitante registrado'
                    else 'Visitante común'
                end as role_name,
                count(*) as entry_count,
                count(distinct e.session_id) as visitor_count,
                min(case
                    when s.visitor_role = 'admin' then 1
                    when s.visitor_role = 'tenant' then 2
                    when s.visitor_role in ('member', 'authenticated') then 3
                    else 4
                end) as sort_order
                from public.analytics_events e
                join public.analytics_sessions s on s.id = e.session_id and s.mall_id = p_mall_id
                where e.mall_id = p_mall_id and e.event_name = 'mall_entered' and e.occurred_at >= starts_at
                group by case
                    when s.visitor_role = 'admin' then 'Administrador'
                    when s.visitor_role = 'tenant' then 'Locatario'
                    when s.visitor_role in ('member', 'authenticated') then 'Visitante registrado'
                    else 'Visitante común'
                end
            ) role_row
        ), '[]'::jsonb),
        'conversations', coalesce((
            select jsonb_agg(row_to_json(conversation_row)::jsonb order by conversation_row.question_count desc)
            from (
                select coalesce(nullif(e.item_label, ''), nullif(e.local_code, ''), 'Asistente del mall') as label,
                       count(*) as question_count, count(distinct e.session_id) as visitor_count
                from public.analytics_events e
                where e.mall_id = p_mall_id and e.event_name = 'assistant_question_sent' and e.occurred_at >= starts_at
                group by coalesce(nullif(e.item_label, ''), nullif(e.local_code, ''), 'Asistente del mall')
                order by question_count desc limit 8
            ) conversation_row
        ), '[]'::jsonb),
        'feedback', coalesce((
            select jsonb_agg(row_to_json(feedback_row)::jsonb order by feedback_row.label)
            from (
                select case f.category when 'complaint' then 'Reclamos' else 'Sugerencias' end as label,
                       count(*) as count
                from public.mall_feedback f
                where f.mall_id = p_mall_id and f.created_at >= starts_at
                group by f.category
            ) feedback_row
        ), '[]'::jsonb),
        'recent_activity', coalesce((
            select jsonb_agg(jsonb_build_object(
                'label', case e.event_name
                    when 'zone_entered' then 'Recorrido por sector'
                    when 'maze_started' then 'Inicio de laberinto'
                    when 'maze_completed' then 'Laberinto completado'
                    when 'maze_exited' then 'Salida del laberinto'
                    when 'assistant_question_sent' then 'Consulta al asistente'
                    when 'feedback_submitted' then 'Mensaje enviado'
                    else replace(e.event_name, '_', ' ')
                end || coalesce(' · ' || nullif(e.item_label, ''), ''),
                'detail', 'Sesión ' || left(replace(e.session_id::text, '-', ''), 6) || ' · ' || to_char(e.occurred_at, 'DD/MM HH24:MI')
            ) order by e.occurred_at desc)
            from (
                select e.* from public.analytics_events e
                where e.mall_id = p_mall_id and e.occurred_at >= starts_at
                  and e.event_name in ('zone_entered', 'maze_started', 'maze_completed', 'maze_exited', 'assistant_question_sent', 'feedback_submitted')
                order by e.occurred_at desc limit 20
            ) e
        ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.get_mall_operations_dashboard(uuid, integer) from public, anon;
grant execute on function public.get_mall_operations_dashboard(uuid, integer) to authenticated;

commit;
