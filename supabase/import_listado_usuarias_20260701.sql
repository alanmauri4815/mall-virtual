-- Importa/actualiza usuarias del listado Proyecto 1 Año 2026.
-- Ejecutar en Supabase SQL Editor.
--
-- Importante:
-- - Este SQL NO crea usuarios en Authentication.
-- - Si el correo ya existe en Authentication, vincula owner_id automaticamente.
-- - Si el correo no existe en Authentication, deja el local reservado con contact_email.
-- - Es idempotente: puedes ejecutarlo mas de una vez sin duplicar postulaciones por correo.

begin;

with source_users(full_name, local_code, rut, address, phone, email) as (
    values
        ('Andrea Nicole Edwards Sanchez', 'SE-10', '11.850.806-8', 'Antonio Varas 1362 Depto. 51 Providencia', '975364024', 'andrea.edwards@gmail.com'),
        ('Alicia Colque Torres', null, '8.805.647-7', 'Av. Manuel Montt 0115 Depto. 402 Providencia', '935713105', 'acolque@gmail.com'),
        ('Ayda Perez Chacon', 'E-105', '22.355.422-9', 'Pedro de Valdivia 150 Depto. 913 Providencia', '950906810', 'aydaperez6841@gmail.com'),
        ('Barbara Drocco Alvarado', null, '26.980.856-K', 'Av. Condell 1367 Providencia', '927265198', 'barbaradrocco.75@gmail.com'),
        ('Deisy Crisila Mancilla Fernandez', 'N-104', '16.446.216-1', 'Antonio Varas 2060, Casa 17', '958657769', 'deisycrisila@gmail.com'),
        ('Evelyn Avila Riquelme', 'EN-10', '14.188.524-3', 'Av. Providencia 2411 Depto. 32 Providencia', '976996226', 'eve.avilariquelme@gmail.com'),
        ('Evelyn Meza Orellana', 'E-104', '12.514.093-9', 'Roman Diaz 305 Depto. 21 Providencia', '998240782', 'mezaevelyn378@gmail.com'),
        ('Griselda Cortes Acuna', 'N-103', '9.356.387-5', 'Diego de Almagro 2285 Depto. 501 Providencia', '976681266', 'griceterapias@gmail.com'),
        ('Isabel Cofre Cathriman', null, '12.261.487-5', 'Eliodoro Yañez 1325 Depto. 203 Providencia', '993448878', 'isa7cfre77@gmail.com'),
        ('Irma Mazuela Saldias', 'S-105', '6.698.987-9', 'Vicuna Mackenna 58 Dpto. 703', '998969823', 'irmamazzu@hotmail.com'),
        ('Mabel Fabiola Lopez Navarrete', 'E-103', '9.099.563-4', 'Av. Italia 1112 Providencia', '932333277', 'mabellopez.comercial58@gmail.com'),
        ('Maribel Ortiz Jimenez', 'NO-10', '27.028.202-4', 'Rafael Canas 270 Providencia', '995574135', 'marior.2307@gmail.com'),
        ('Sandy Maldonado Medina', null, '26.132.569-1', 'Rodo 1912 Providencia', '978511128', 'cakekellys.com@gmail.com'),
        ('Soledad Ramirez Candia', null, '13.057.402-5', null, '934634507', 'sybil.orfebreria@gmail.com'),
        ('Rita Huarapil Molina', null, '14.422.878-2', null, '975224511', 'ritahuarapilm@gmail.com'),
        ('Rubi Rondan Diaz', null, '21.972.703-8', null, '958186211', 'sparubinails@gmail.com'),
        ('Sara Cruz Blanco', null, '9.696.347-5', 'Jose Manuel Infane 7 Depto. 603 Providencia', '932197281', 'saracruzcomunicaciones@gmail.com'),
        ('Ximena Porras Salomon', 'E-107', '15.466.043-7', 'Jose Forteza 1921 Depto. 3 Providencia', '995203692', 'ximenaporras@gmail.com')
),
normalized_users as (
    select
        full_name,
        upper(nullif(trim(local_code), '')) as local_code,
        rut,
        address,
        phone,
        lower(trim(email)) as email
    from source_users
),
users_with_auth as (
    select
        nu.*,
        au.id as auth_user_id
    from normalized_users nu
    left join auth.users au
      on lower(au.email) = nu.email
),
updated_applications as (
    update public.tenant_applications ta
    set
        brand_name = uwa.full_name,
        category = coalesce(nullif(ta.category, ''), 'Proyecto 1 Año 2026'),
        phone = uwa.phone,
        applicant_auth_user_id = coalesce(ta.applicant_auth_user_id, uwa.auth_user_id),
        status = case
            when uwa.local_code is not null then 'approved'
            else coalesce(nullif(ta.status, ''), 'pending')
        end
    from users_with_auth uwa
    where lower(ta.email) = uwa.email
    returning lower(ta.email) as email
)
insert into public.tenant_applications (
    brand_name,
    category,
    email,
    phone,
    social_link,
    applicant_auth_user_id,
    status
)
select
    uwa.full_name,
    'Proyecto 1 Año 2026',
    uwa.email,
    uwa.phone,
    null,
    uwa.auth_user_id,
    case when uwa.local_code is not null then 'approved' else 'pending' end
from users_with_auth uwa
where not exists (
    select 1
    from public.tenant_applications ta
    where lower(ta.email) = uwa.email
);

with source_users(full_name, local_code, rut, address, phone, email) as (
    values
        ('Andrea Nicole Edwards Sanchez', 'SE-10', '11.850.806-8', 'Antonio Varas 1362 Depto. 51 Providencia', '975364024', 'andrea.edwards@gmail.com'),
        ('Ayda Perez Chacon', 'E-105', '22.355.422-9', 'Pedro de Valdivia 150 Depto. 913 Providencia', '950906810', 'aydaperez6841@gmail.com'),
        ('Deisy Crisila Mancilla Fernandez', 'N-104', '16.446.216-1', 'Antonio Varas 2060, Casa 17', '958657769', 'deisycrisila@gmail.com'),
        ('Evelyn Avila Riquelme', 'EN-10', '14.188.524-3', 'Av. Providencia 2411 Depto. 32 Providencia', '976996226', 'eve.avilariquelme@gmail.com'),
        ('Evelyn Meza Orellana', 'E-104', '12.514.093-9', 'Roman Diaz 305 Depto. 21 Providencia', '998240782', 'mezaevelyn378@gmail.com'),
        ('Griselda Cortes Acuña', 'N-103', '9.356.387-5', 'Diego de Almagro 2285 Depto. 501 Providencia', '976681266', 'griceterapias@gmail.com'),
        ('Irma Mazuela Saldias', 'S-105', '6.698.987-9', 'Vicuña Mackenna 58 Dpto. 703', '998969823', 'irmamazzu@hotmail.com'),
        ('Mabel Fabiola Lopez Navarrete', 'E-103', '9.099.563-4', 'Av. Italia 1112 Providencia', '932333277', 'mabellopez.comercial58@gmail.com'),
        ('Maribel Ortiz Jimenez', 'NO-10', '27.028.202-4', 'Rafael Cañas 270 Providencia', '995574135', 'marior.2307@gmail.com'),
        ('Ximena Porras Salomon', 'E-107', '15.466.043-7', 'Jose Forteza 1921 Depto. 3 Providencia', '995203692', 'ximenaporras@gmail.com')
),
users_with_auth as (
    select
        su.full_name,
        upper(trim(su.local_code)) as local_code,
        su.phone,
        lower(trim(su.email)) as email,
        au.id as auth_user_id
    from source_users su
    left join auth.users au
      on lower(au.email) = lower(trim(su.email))
)
update public.stores s
set
    owner_id = coalesce(uwa.auth_user_id, s.owner_id),
    name = uwa.full_name,
    contact_email = uwa.email,
    contact_phone = uwa.phone,
    whatsapp = uwa.phone,
    service_status = case
        when uwa.auth_user_id is not null then 'active'
        else 'reserved'
    end,
    service_status_note = case
        when uwa.auth_user_id is not null then null
        else 'Local reservado desde listado Proyecto 1 Año 2026. Falta crear cuenta Auth o volver a ejecutar este SQL cuando exista.'
    end,
    updated_at = now()
from users_with_auth uwa
where upper(replace(s.local_code, '-', '')) = upper(replace(uwa.local_code, '-', ''))
   or upper(replace(s.id::text, '-', '')) = upper(replace(uwa.local_code, '-', ''));

commit;

-- Verificacion final: muestra que correos tienen Auth y que locales quedaron vinculados/reservados.
with source_users(full_name, local_code, email) as (
    values
        ('Andrea Nicole Edwards Sanchez', 'SE-10', 'andrea.edwards@gmail.com'),
        ('Alicia Colque Torres', null, 'acolque@gmail.com'),
        ('Ayda Perez Chacon', 'E-105', 'aydaperez6841@gmail.com'),
        ('Barbara Drocco Alvarado', null, 'barbaradrocco.75@gmail.com'),
        ('Deisy Crisila Mancilla Fernandez', 'N-104', 'deisycrisila@gmail.com'),
        ('Evelyn Avila Riquelme', 'EN-10', 'eve.avilariquelme@gmail.com'),
        ('Evelyn Meza Orellana', 'E-104', 'mezaevelyn378@gmail.com'),
        ('Griselda Cortes Acuña', 'N-103', 'griceterapias@gmail.com'),
        ('Isabel Cofre Cathriman', null, 'isa7cfre77@gmail.com'),
        ('Irma Mazuela Saldias', 'S-105', 'irmamazzu@hotmail.com'),
        ('Mabel Fabiola Lopez Navarrete', 'E-103', 'mabellopez.comercial58@gmail.com'),
        ('Maribel Ortiz Jimenez', 'NO-10', 'marior.2307@gmail.com'),
        ('Sandy Maldonado Medina', null, 'cakekellys.com@gmail.com'),
        ('Soledad Ramirez Candia', null, 'sybil.orfebreria@gmail.com'),
        ('Rita Huarapil Molina', null, 'ritahuarapilm@gmail.com'),
        ('Rubi Rondan Diaz', null, 'sparubinails@gmail.com'),
        ('Sara Cruz Blanco', null, 'saracruzcomunicaciones@gmail.com'),
        ('Ximena Porras Salomon', 'E-107', 'ximenaporras@gmail.com')
)
select
    su.full_name,
    su.local_code as local_solicitado,
    lower(su.email) as email,
    au.id as auth_uid,
    case when au.id is null then 'SIN AUTH: crear usuario en Authentication' else 'AUTH OK' end as auth_estado,
    st.id as store_id,
    st.local_code as store_local_code,
    st.owner_id,
    st.service_status
from source_users su
left join auth.users au
  on lower(au.email) = lower(su.email)
left join public.stores st
  on su.local_code is not null
 and (
    upper(replace(st.local_code, '-', '')) = upper(replace(su.local_code, '-', ''))
    or upper(replace(st.id::text, '-', '')) = upper(replace(su.local_code, '-', ''))
 )
order by su.full_name;
