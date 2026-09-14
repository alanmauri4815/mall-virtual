-- Quinta fase multimall: analitica por mall.
-- Asigna los registros historicos sin mall al unico mall actual y protege nuevas escrituras.

begin;

do $$
begin
    if not exists (
        select 1
        from public.malls
        where id = '713c1740-0621-4fd7-98e6-fac2a93e4781'
    ) then
        raise exception 'No existe el mall Providencia esperado.';
    end if;
end;
$$;

-- Actualmente solo existe un mall operativo; los eventos sin mall son historicos de el.
update public.analytics_sessions
set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781'
where mall_id is null;

update public.analytics_events
set mall_id = '713c1740-0621-4fd7-98e6-fac2a93e4781'
where mall_id is null;

drop function if exists public.record_analytics_event(
    uuid, uuid, text, text, text, text, text, text, text, integer, integer, text
);

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
    if p_client_event_id is null or p_session_id is null or p_mall_id is null then
        return false;
    end if;

    if not exists (select 1 from public.malls where id = p_mall_id) then
        return false;
    end if;

    if exists (
        select 1
        from public.analytics_sessions s
        where s.id = p_session_id
          and s.mall_id is distinct from p_mall_id
    ) then
        return false;
    end if;

    if clean_event_name not in (
        'session_started',
        'mall_entered',
        'search_opened',
        'search_submitted',
        'search_result_clicked',
        'route_requested',
        'store_attention_qualified',
        'store_attention_ended',
        'store_opened',
        'product_viewed',
        'contact_clicked',
        'message_sent',
        'login_succeeded'
    ) then
        return false;
    end if;

    if clean_device_class not in ('mobile', 'tablet', 'desktop') then
        clean_device_class := 'desktop';
    end if;

    if auth.uid() is not null then
        resolved_role := 'authenticated';
        if public.is_mall_admin_for(p_mall_id) then
            resolved_role := 'admin';
        elsif exists (
            select 1 from public.stores s
            where s.owner_id = auth.uid()
              and s.mall_id = p_mall_id
        ) then
            resolved_role := 'tenant';
        elsif exists (
            select 1 from public.mall_members mm
            where mm.auth_user_id = auth.uid()
        ) then
            resolved_role := 'member';
        end if;
    end if;

    if (
        select count(*)
        from public.analytics_events e
        where e.session_id = p_session_id
          and e.mall_id = p_mall_id
          and e.occurred_at >= now() - interval '1 minute'
    ) >= 90 then
        return false;
    end if;

    if nullif(trim(coalesce(p_store_code, '')), '') is not null then
        select s.id, s.local_code
        into resolved_store_id, resolved_local_code
        from public.stores s
        where s.mall_id = p_mall_id
          and (
              upper(replace(trim(s.id::text), '-', '')) = upper(replace(trim(p_store_code), '-', ''))
              or upper(replace(trim(s.local_code), '-', '')) = upper(replace(trim(p_store_code), '-', ''))
          )
        order by case
            when upper(replace(trim(s.local_code), '-', '')) = upper(replace(trim(p_store_code), '-', '')) then 0
            else 1
        end
        limit 1;
    end if;

    if p_product_id is not null and exists (
        select 1
        from public.store_products sp
        where sp.mall_id = p_mall_id
          and sp.id::text = p_product_id
          and (
              resolved_store_id is null
              or upper(replace(trim(coalesce(sp.local_code, '')), '-', ''))
                 = upper(replace(trim(coalesce(resolved_local_code, '')), '-', ''))
          )
    ) then
        resolved_product_id := p_product_id;
    end if;

    clean_search_term := left(
        regexp_replace(lower(trim(coalesce(p_search_term, ''))), '\\s+', ' ', 'g'),
        80
    );
    if clean_search_term = ''
       or clean_search_term like '%@%'
       or clean_search_term ~ '(\\+?[0-9][[:space:]().-]*){7,}' then
        clean_search_term := null;
    end if;

    clean_channel := nullif(left(lower(trim(coalesce(p_channel, ''))), 24), '');
    if clean_channel is not null
       and clean_channel not in ('email', 'whatsapp', 'telegram', 'form', 'social', 'catalog', 'map') then
        clean_channel := null;
    end if;

    clean_source := nullif(left(lower(trim(coalesce(p_source, ''))), 40), '');
    clean_item_label := nullif(left(trim(coalesce(p_item_label, '')), 120), '');
    clean_duration_ms := case
        when p_duration_ms is null then null
        else least(600000, greatest(0, p_duration_ms))
    end;
    clean_result_count := case
        when p_result_count is null then null
        else least(500, greatest(0, p_result_count))
    end;

    insert into public.analytics_sessions (
        id,
        mall_id,
        auth_user_id,
        visitor_role,
        device_class,
        started_at,
        last_seen_at
    )
    values (
        p_session_id,
        p_mall_id,
        auth.uid(),
        resolved_role,
        clean_device_class,
        now(),
        now()
    )
    on conflict (id) do update
    set mall_id = excluded.mall_id,
        auth_user_id = coalesce(excluded.auth_user_id, analytics_sessions.auth_user_id),
        visitor_role = excluded.visitor_role,
        device_class = excluded.device_class,
        last_seen_at = now();

    insert into public.analytics_events (
        mall_id,
        client_event_id,
        session_id,
        auth_user_id,
        visitor_role,
        event_name,
        store_id,
        local_code,
        product_id,
        search_term,
        channel,
        source,
        item_label,
        duration_ms,
        result_count,
        device_class,
        metadata
    )
    values (
        p_mall_id,
        p_client_event_id,
        p_session_id,
        auth.uid(),
        resolved_role,
        clean_event_name,
        resolved_store_id,
        resolved_local_code,
        resolved_product_id,
        clean_search_term,
        clean_channel,
        clean_source,
        clean_item_label,
        clean_duration_ms,
        clean_result_count,
        clean_device_class,
        jsonb_strip_nulls(jsonb_build_object(
            'duration_bucket',
            case
                when clean_duration_ms is null then null
                when clean_duration_ms <= 5000 then '3-5s'
                when clean_duration_ms <= 10000 then '6-10s'
                when clean_duration_ms <= 20000 then '11-20s'
                else '20s+'
            end
        ))
    )
    on conflict (client_event_id) do nothing;

    return true;
end;
$$;

revoke all on function public.record_analytics_event(
    uuid, uuid, text, text, text, text, text, text, text, integer, integer, text, uuid
) from public;
grant execute on function public.record_analytics_event(
    uuid, uuid, text, text, text, text, text, text, text, integer, integer, text, uuid
) to anon, authenticated;

alter table public.analytics_sessions alter column mall_id set not null;
alter table public.analytics_events alter column mall_id set not null;

commit;
