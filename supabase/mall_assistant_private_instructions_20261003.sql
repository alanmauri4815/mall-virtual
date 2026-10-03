begin;

-- Private behavior guidance is stored separately from public mall assistant settings.
create table if not exists public.mall_assistant_instructions (
    mall_id uuid primary key references public.malls(id) on delete cascade,
    instructions text not null default '' check (char_length(instructions) <= 3000),
    updated_at timestamptz not null default now()
);

alter table public.mall_assistant_instructions enable row level security;

revoke all on public.mall_assistant_instructions from anon, authenticated;
grant select, insert, update on public.mall_assistant_instructions to authenticated;
grant all on public.mall_assistant_instructions to service_role;

drop policy if exists "Mall admins manage private assistant instructions"
    on public.mall_assistant_instructions;
create policy "Mall admins manage private assistant instructions"
on public.mall_assistant_instructions for all
to authenticated
using (public.is_mall_admin_for(mall_id))
with check (public.is_mall_admin_for(mall_id));

drop trigger if exists mall_assistant_instructions_mall_scope_guard
    on public.mall_assistant_instructions;
create trigger mall_assistant_instructions_mall_scope_guard
before insert or update on public.mall_assistant_instructions
for each row execute function public.protect_mall_scope_change();

comment on table public.mall_assistant_instructions is
    'Private, mall-scoped behavior instructions for the information assistant; readable only by mall admins and the server role.';

commit;
