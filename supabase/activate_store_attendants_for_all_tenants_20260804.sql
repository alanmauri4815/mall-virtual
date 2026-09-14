begin;

insert into public.store_bot_settings (
    store_id,
    enabled,
    assistant_name,
    greeting
)
select
    s.id,
    true,
    'Asistente',
    'Hola, soy el asistente de ' || coalesce(nullif(trim(s.name), ''), s.local_code, 'esta tienda') || '. ¿En qué puedo ayudarte?'
from public.stores s
where s.owner_id is not null
on conflict (store_id) do update
set enabled = true,
    updated_at = now();

create or replace function public.ensure_store_attendant_for_assigned_store()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.owner_id is not null
       and (tg_op = 'INSERT' or old.owner_id is distinct from new.owner_id) then
        insert into public.store_bot_settings (
            store_id,
            enabled,
            assistant_name,
            greeting
        )
        values (
            new.id,
            true,
            'Asistente',
            'Hola, soy el asistente de ' || coalesce(nullif(trim(new.name), ''), new.local_code, 'esta tienda') || '. ¿En qué puedo ayudarte?'
        )
        on conflict (store_id) do update
        set enabled = true,
            updated_at = now();
    end if;

    return new;
end;
$$;

drop trigger if exists stores_ensure_store_attendant on public.stores;
create trigger stores_ensure_store_attendant
after insert or update of owner_id on public.stores
for each row
execute function public.ensure_store_attendant_for_assigned_store();

commit;
