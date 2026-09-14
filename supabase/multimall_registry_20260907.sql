-- Etapa aditiva: ejecutar primero en un entorno de ensayo restaurado.
-- No habilita aislamiento multimall ni autoriza crear malls publicos.
begin;

create table if not exists public.malls (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    display_name text not null check (length(trim(display_name)) > 0),
    commune text not null,
    status text not null default 'draft' check (status in ('draft', 'testing', 'published', 'suspended')),
    template_version text not null,
    created_at timestamptz not null default now()
);

alter table public.malls enable row level security;
revoke all on public.malls from public, anon, authenticated;

-- UUID estable: cambiar nombre o slug no cambia la identidad del mall.
insert into public.malls (id, slug, display_name, commune, status, template_version)
values ('713c1740-0621-4fd7-98e6-fac2a93e4781', 'providencia',
        'Mall Providencia', 'Providencia', 'draft', 'mall-shared-v1')
on conflict (id) do nothing;

commit;
