begin;

create temporary table tmp_store_code_map (
    store_id text primary key,
    canonical_local_code text not null
) on commit drop;

insert into tmp_store_code_map (store_id, canonical_local_code)
select
    s.id as store_id,
    coalesce(
        linked_space.display_code,
        matched_space.display_code,
        nullif(trim(s.local_code), ''),
        trim(s.id)
    ) as canonical_local_code
from public.stores s
left join lateral (
    select ps.display_code
    from public.store_physical_links spl
    join public.physical_spaces ps
      on ps.physical_space_id = spl.physical_space_id
    where spl.store_id = s.id
      and nullif(trim(ps.display_code), '') is not null
    order by spl.is_primary desc, spl.id asc
    limit 1
) linked_space on true
left join lateral (
    select ps.display_code
    from public.physical_spaces ps
    where nullif(trim(ps.display_code), '') is not null
      and (
          upper(trim(ps.source_code)) = upper(trim(s.id))
          or upper(trim(ps.source_code)) = upper(trim(coalesce(s.local_code, '')))
          or upper(trim(ps.display_code)) = upper(trim(s.id))
          or upper(trim(ps.display_code)) = upper(trim(coalesce(s.local_code, '')))
      )
    order by
      case
        when upper(trim(ps.source_code)) = upper(trim(s.id)) then 0
        when upper(trim(ps.source_code)) = upper(trim(coalesce(s.local_code, ''))) then 1
        when upper(trim(ps.display_code)) = upper(trim(coalesce(s.local_code, ''))) then 2
        else 3
      end,
      ps.physical_space_id
    limit 1
) matched_space on true;

update public.stores s
set local_code = m.canonical_local_code
from tmp_store_code_map m
where s.id = m.store_id
  and coalesce(trim(s.local_code), '') <> coalesce(trim(m.canonical_local_code), '');

create temporary table tmp_store_lookup_keys (
    lookup_key text primary key,
    store_id text not null,
    canonical_local_code text not null
) on commit drop;

insert into tmp_store_lookup_keys (lookup_key, store_id, canonical_local_code)
select distinct
    upper(trim(key_value)) as lookup_key,
    m.store_id,
    m.canonical_local_code
from tmp_store_code_map m
join public.stores s
  on s.id = m.store_id
cross join lateral (
    values
        (s.id),
        (s.local_code),
        (m.canonical_local_code)
) as base_keys(key_value)
where nullif(trim(base_keys.key_value), '') is not null
on conflict (lookup_key) do nothing;

insert into tmp_store_lookup_keys (lookup_key, store_id, canonical_local_code)
select distinct
    upper(trim(extra_keys.key_value)) as lookup_key,
    m.store_id,
    m.canonical_local_code
from tmp_store_code_map m
join public.stores s
  on s.id = m.store_id
left join public.store_physical_links spl
  on spl.store_id = s.id
left join public.physical_spaces ps
  on ps.physical_space_id = spl.physical_space_id
cross join lateral (
    values
        (ps.source_code),
        (ps.display_code)
) as extra_keys(key_value)
where nullif(trim(extra_keys.key_value), '') is not null
on conflict (lookup_key) do nothing;

update public.store_rent_rates rr
set store_id = lk.store_id
from tmp_store_lookup_keys lk
where upper(trim(rr.store_id)) = lk.lookup_key
  and rr.store_id <> lk.store_id;

update public.store_rent_rates rr
set local_code = m.canonical_local_code
from tmp_store_code_map m
where rr.store_id = m.store_id
  and coalesce(trim(rr.local_code), '') <> coalesce(trim(m.canonical_local_code), '');

update public.tenant_leases tl
set store_id = lk.store_id
from tmp_store_lookup_keys lk
where upper(trim(tl.store_id)) = lk.lookup_key
  and tl.store_id <> lk.store_id;

update public.tenant_leases tl
set local_code = m.canonical_local_code
from tmp_store_code_map m
where tl.store_id = m.store_id
  and coalesce(trim(tl.local_code), '') <> coalesce(trim(m.canonical_local_code), '');

update public.tenant_payments tp
set store_id = lk.store_id
from tmp_store_lookup_keys lk
where upper(trim(tp.store_id)) = lk.lookup_key
  and tp.store_id <> lk.store_id;

update public.tenant_payments tp
set local_code = m.canonical_local_code
from tmp_store_code_map m
where tp.store_id = m.store_id
  and coalesce(trim(tp.local_code), '') <> coalesce(trim(m.canonical_local_code), '');

update public.tenant_notes tn
set store_id = lk.store_id
from tmp_store_lookup_keys lk
where upper(trim(tn.store_id)) = lk.lookup_key
  and tn.store_id <> lk.store_id;

update public.tenant_notes tn
set local_code = m.canonical_local_code
from tmp_store_code_map m
where tn.store_id = m.store_id
  and coalesce(trim(tn.local_code), '') <> coalesce(trim(m.canonical_local_code), '');

update public.contact_messages cm
set store_id = lk.store_id
from tmp_store_lookup_keys lk
where cm.store_id is not null
  and upper(trim(cm.store_id)) = lk.lookup_key
  and cm.store_id <> lk.store_id;

update public.mall_messages mm
set store_id = lk.store_id
from tmp_store_lookup_keys lk
where mm.store_id is not null
  and upper(trim(mm.store_id)) = lk.lookup_key
  and mm.store_id <> lk.store_id;

update public.mall_messages mm
set local_code = m.canonical_local_code
from tmp_store_code_map m
where (
        mm.store_id = m.store_id
        or upper(trim(coalesce(mm.local_code, ''))) = upper(trim(m.canonical_local_code))
      )
  and coalesce(trim(mm.local_code), '') <> coalesce(trim(m.canonical_local_code), '');

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'store_products'
          and column_name = 'store_id'
    ) then
        execute $sql$
            update public.store_products sp
            set store_id = lk.store_id
            from tmp_store_lookup_keys lk
            where sp.store_id is not null
              and upper(trim(sp.store_id)) = lk.lookup_key
              and sp.store_id <> lk.store_id
        $sql$;
    end if;
end $$;

update public.store_products sp
set local_code = m.canonical_local_code
from tmp_store_lookup_keys lk
join tmp_store_code_map m
  on m.store_id = lk.store_id
where upper(trim(coalesce(sp.local_code, ''))) = lk.lookup_key
  and coalesce(trim(sp.local_code), '') <> coalesce(trim(m.canonical_local_code), '');

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'site_content'
          and column_name = 'store_id'
    ) then
        execute $sql$
            update public.site_content sc
            set store_id = lk.store_id
            from tmp_store_lookup_keys lk
            where sc.store_id is not null
              and upper(trim(sc.store_id)) = lk.lookup_key
              and sc.store_id <> lk.store_id
        $sql$;
    end if;
end $$;

commit;

-- Verificaciones sugeridas:
-- 1. select id, local_code, name from public.stores order by local_code nulls last, id;
-- 2. select id, store_id, local_code from public.tenant_leases order by id desc;
-- 3. select id, local_code, name, price from public.store_products order by id desc limit 20;
