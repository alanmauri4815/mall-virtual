begin;

alter table public.store_bot_settings
    add column if not exists store_brief text not null default '';

comment on column public.store_bot_settings.store_brief is
'Inducción breve del local para orientar al asistente: rubro, productos, público objetivo, tono de atención y datos relevantes del negocio.';

commit;
