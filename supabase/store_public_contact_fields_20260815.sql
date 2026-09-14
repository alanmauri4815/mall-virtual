begin;

alter table public.stores add column if not exists social_url text;
alter table public.stores add column if not exists address text;
alter table public.stores add column if not exists maps_url text;

comment on column public.stores.contact_phone is 'Teléfono público para llamadas del local.';
comment on column public.stores.whatsapp is 'Número público de WhatsApp del local, idealmente con código de país.';
comment on column public.stores.social_url is 'URL pública de Instagram u otra red social del local.';
comment on column public.stores.address is 'Dirección pública o punto de retiro mostrado en el catálogo.';
comment on column public.stores.maps_url is 'URL opcional de Google Maps u otro mapa para abrir la ubicación exacta.';

commit;
