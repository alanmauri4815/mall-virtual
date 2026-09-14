-- Globo dorado: promociones coleccionables vinculadas a mobiliario editable.
-- Ejecutar despues de member_benefits_20260803.sql y mall_object_editor_20260815.sql.

begin;

alter table public.mall_promotions
    add column if not exists status text not null default 'placed',
    add column if not exists max_claims integer not null default 0,
    add column if not exists object_id text,
    add column if not exists position_x double precision,
    add column if not exists position_y double precision,
    add column if not exists position_z double precision,
    add column if not exists found_at timestamptz,
    add column if not exists found_by uuid references auth.users(id) on delete set null,
    add column if not exists redeemed_at timestamptz,
    add column if not exists redeemed_by uuid references auth.users(id) on delete set null,
    add column if not exists redemption_count integer not null default 0;

alter table public.mall_promotions drop constraint if exists mall_promotions_status_check;
alter table public.mall_promotions add constraint mall_promotions_status_check
    check (status in ('placed', 'found', 'expired', 'redeemed', 'cancelled'));

alter table public.mall_promotions drop constraint if exists mall_promotions_max_claims_check;
alter table public.mall_promotions add constraint mall_promotions_max_claims_check
    check (max_claims >= 0);

alter table public.mall_promotions drop constraint if exists mall_promotions_redemption_count_check;
alter table public.mall_promotions add constraint mall_promotions_redemption_count_check
    check (redemption_count >= 0);

create index if not exists mall_promotions_object_idx
on public.mall_promotions (object_id)
where object_id is not null;

create table if not exists public.mall_promotion_codes (
    promotion_id uuid primary key references public.mall_promotions(id) on delete cascade,
    discount_code text not null check (char_length(trim(discount_code)) between 1 and 64),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.mall_promotion_codes enable row level security;

revoke all on public.mall_promotion_codes from anon;
revoke all on public.mall_promotion_codes from authenticated;
grant select, insert, update, delete on public.mall_promotion_codes to authenticated;

drop policy if exists "Admins manage promotion codes" on public.mall_promotion_codes;
create policy "Admins manage promotion codes"
on public.mall_promotion_codes for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create or replace function public.get_member_benefits_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
    current_month date := date_trunc('month', now())::date;
    monthly_total numeric(12,2) := 0;
    promotion_rows jsonb := '[]'::jsonb;
begin
    if not public.has_mall_member_benefits() then
        raise exception 'Esta funcion requiere una cuenta inscrita.';
    end if;

    select coalesce((
        select activity.meters_walked
        from public.member_monthly_activity activity
        where activity.auth_user_id = auth.uid()
          and activity.month_start = current_month
    ), 0)
    into monthly_total;

    select coalesce(jsonb_agg(to_jsonb(result_row) order by result_row.starts_at), '[]'::jsonb)
    into promotion_rows
    from (
        select
            promotion.id,
            promotion.title,
            promotion.description,
            promotion.promotion_type,
            promotion.reward_label,
            promotion.min_monthly_meters,
            promotion.starts_at,
            promotion.ends_at,
            promotion.status,
            promotion.object_id,
            promotion.position_x,
            promotion.position_y,
            promotion.position_z,
            claim.claimed_at
        from public.mall_promotions promotion
        left join public.mall_promotion_claims claim
          on claim.promotion_id = promotion.id
         and claim.auth_user_id = auth.uid()
        where promotion.active
          and promotion.starts_at <= now()
          and (promotion.ends_at is null or promotion.ends_at > now())
          and promotion.status not in ('cancelled', 'redeemed')
          and (promotion.promotion_type <> 'golden_balloon' or promotion.status = 'placed')
    ) result_row;

    return jsonb_build_object(
        'month_start', current_month,
        'monthly_meters', monthly_total,
        'promotions', promotion_rows
    );
end;
$$;

revoke all on function public.get_member_benefits_summary() from public;
grant execute on function public.get_member_benefits_summary() to authenticated;

create or replace function public.claim_member_promotion(
    p_promotion_id uuid,
    p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    promotion_row public.mall_promotions%rowtype;
    code_row public.mall_promotion_codes%rowtype;
    current_month date := date_trunc('month', now())::date;
    monthly_total numeric(12,2) := 0;
    claim_row public.mall_promotion_claims%rowtype;
    existing_claim boolean := false;
    total_claims integer := 0;
begin
    if not public.has_mall_member_benefits() then
        raise exception 'Esta funcion requiere una cuenta inscrita.';
    end if;

    select * into promotion_row
    from public.mall_promotions promotion
    where promotion.id = p_promotion_id
      and promotion.active
      and promotion.starts_at <= now()
      and (promotion.ends_at is null or promotion.ends_at > now())
      and promotion.status not in ('cancelled', 'expired', 'redeemed')
    for update;

    if promotion_row.id is null then
        update public.mall_promotions
        set status = 'expired', active = false, updated_at = now()
        where id = p_promotion_id
          and ends_at is not null
          and ends_at <= now()
          and status not in ('cancelled', 'redeemed');
        raise exception 'La promocion no esta activa o ya caduco.';
    end if;

    select exists (
        select 1 from public.mall_promotion_claims claim
        where claim.promotion_id = promotion_row.id
          and claim.auth_user_id = auth.uid()
    ) into existing_claim;

    select count(*) into total_claims
    from public.mall_promotion_claims claim
    where claim.promotion_id = promotion_row.id;

    if not existing_claim and promotion_row.max_claims > 0 and total_claims >= promotion_row.max_claims then
        raise exception 'Este Globo dorado ya fue encontrado.';
    end if;

    select coalesce((
        select activity.meters_walked
        from public.member_monthly_activity activity
        where activity.auth_user_id = auth.uid()
          and activity.month_start = current_month
    ), 0)
    into monthly_total;

    if monthly_total < promotion_row.min_monthly_meters then
        raise exception 'Aun no alcanzas los metros requeridos para esta promocion.';
    end if;

    select * into code_row
    from public.mall_promotion_codes code
    where code.promotion_id = promotion_row.id;

    if promotion_row.promotion_type = 'golden_balloon' and code_row.promotion_id is null then
        raise exception 'La promocion no tiene un codigo configurado.';
    end if;

    insert into public.mall_promotion_claims (promotion_id, auth_user_id, evidence)
    values (promotion_row.id, auth.uid(), coalesce(p_evidence, '{}'::jsonb))
    on conflict (promotion_id, auth_user_id) do update
    set evidence = public.mall_promotion_claims.evidence || excluded.evidence
    returning * into claim_row;

    update public.mall_promotions
    set status = case when promotion_type = 'golden_balloon' then 'found' else status end,
        found_at = case when promotion_type = 'golden_balloon' then coalesce(found_at, now()) else found_at end,
        found_by = case when promotion_type = 'golden_balloon' then coalesce(found_by, auth.uid()) else found_by end,
        redemption_count = (select count(*) from public.mall_promotion_claims where promotion_id = promotion_row.id),
        updated_at = now()
    where id = promotion_row.id;

    return jsonb_build_object(
        'claim_id', claim_row.id,
        'promotion_id', promotion_row.id,
        'reward_label', promotion_row.reward_label,
        'discount_code', code_row.discount_code,
        'status', case when promotion_row.promotion_type = 'golden_balloon' then 'found' else promotion_row.status end,
        'claimed_at', claim_row.claimed_at,
        'message', 'Beneficio registrado. Guarda tu codigo de descuento.'
    );
end;
$$;

revoke all on function public.claim_member_promotion(uuid, jsonb) from public;
grant execute on function public.claim_member_promotion(uuid, jsonb) to authenticated;

create or replace function public.mark_mall_promotion_redeemed(
    p_promotion_id uuid,
    p_claim_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.is_mall_admin() then
        raise exception 'Solo un administrador puede marcar un descuento como canjeado.';
    end if;

    update public.mall_promotions
    set status = 'redeemed', redeemed_at = now(), redeemed_by = auth.uid(), active = false, updated_at = now()
    where id = p_promotion_id;

    if not found then
        raise exception 'No se encontro la promocion.';
    end if;

    return jsonb_build_object('promotion_id', p_promotion_id, 'claim_id', p_claim_id, 'status', 'redeemed');
end;
$$;

revoke all on function public.mark_mall_promotion_redeemed(uuid, uuid) from public;
grant execute on function public.mark_mall_promotion_redeemed(uuid, uuid) to authenticated;

comment on table public.mall_promotion_codes is
    'Codigos privados de promociones. Nunca se exponen en el resumen publico de beneficios; se entregan mediante claim_member_promotion.';
comment on column public.mall_promotions.object_id is
    'Identificador del mobiliario editable que representa el premio fisico, por ejemplo un Globo dorado.';
comment on column public.mall_promotions.status is
    'Ciclo del coleccionable: placed, found, expired, redeemed o cancelled.';

commit;
