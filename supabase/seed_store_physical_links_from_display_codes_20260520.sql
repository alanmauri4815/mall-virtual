begin;

with matches as (
    select distinct
        ps.physical_space_id,
        s.id as store_id,
        s.local_code,
        count(*) over (partition by s.id) as physical_match_count
    from public.physical_spaces ps
    join public.stores s
      on upper(trim(s.local_code)) in (
            upper(trim(ps.display_code)),
            upper(trim(ps.source_code))
         )
),
prepared as (
    select
        physical_space_id,
        store_id,
        case
            when physical_match_count > 1 then 'shared_front'
            else 'exclusive'
        end as relation_type,
        row_number() over (partition by store_id order by physical_space_id) = 1 as is_primary
    from matches
)
insert into public.store_physical_links (
    physical_space_id,
    store_id,
    relation_type,
    is_primary
)
select
    physical_space_id,
    store_id,
    relation_type,
    is_primary
from prepared
on conflict (physical_space_id, store_id) do update
set
    relation_type = excluded.relation_type,
    is_primary = excluded.is_primary,
    updated_at = now();

commit;
