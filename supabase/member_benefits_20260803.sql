-- Mall Creaciones - beneficios para cuentas inscritas.
-- Ejecutar una vez en Supabase SQL Editor. Es repetible.

begin;

create table if not exists public.member_monthly_activity (
    auth_user_id uuid not null references auth.users(id) on delete cascade,
    month_start date not null,
    meters_walked numeric(12,2) not null default 0 check (meters_walked >= 0),
    updated_at timestamptz not null default now(),
    primary key (auth_user_id, month_start)
);

create table if not exists public.mall_promotions (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text not null default '',
    promotion_type text not null default 'general'
        check (promotion_type in ('general', 'golden_balloon', 'monthly_distance')),
    reward_label text not null default '',
    min_monthly_meters numeric(12,2) not null default 0 check (min_monthly_meters >= 0),
    starts_at timestamptz not null default now(),
    ends_at timestamptz,
    active boolean not null default false,
    notify_by_email boolean not null default true,
    announcement_sent_at timestamptz,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.mall_promotion_claims (
    id uuid primary key default gen_random_uuid(),
    promotion_id uuid not null references public.mall_promotions(id) on delete cascade,
    auth_user_id uuid not null references auth.users(id) on delete cascade,
    evidence jsonb not null default '{}'::jsonb,
    claimed_at timestamptz not null default now(),
    email_notification_status text not null default 'pending'
        check (email_notification_status in ('pending', 'sent', 'failed', 'skipped')),
    email_notification_sent_at timestamptz,
    unique (promotion_id, auth_user_id)
);

create index if not exists mall_promotions_active_dates_idx
on public.mall_promotions (active, starts_at, ends_at);

create index if not exists mall_promotion_claims_user_idx
on public.mall_promotion_claims (auth_user_id, claimed_at desc);

alter table public.member_monthly_activity enable row level security;
alter table public.mall_promotions enable row level security;
alter table public.mall_promotion_claims enable row level security;

revoke all on public.member_monthly_activity, public.mall_promotions, public.mall_promotion_claims from anon;
revoke all on public.member_monthly_activity, public.mall_promotions, public.mall_promotion_claims from authenticated;
grant select on public.member_monthly_activity, public.mall_promotions, public.mall_promotion_claims to authenticated;
grant insert, update, delete on public.mall_promotions to authenticated;

drop policy if exists "Members read own monthly activity" on public.member_monthly_activity;
create policy "Members read own monthly activity"
on public.member_monthly_activity for select to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists "Authenticated read active promotions" on public.mall_promotions;
create policy "Authenticated read active promotions"
on public.mall_promotions for select to authenticated
using (
    active
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
);

drop policy if exists "Members read own promotion claims" on public.mall_promotion_claims;
create policy "Members read own promotion claims"
on public.mall_promotion_claims for select to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists "Admins manage promotions" on public.mall_promotions;
create policy "Admins manage promotions"
on public.mall_promotions for all to authenticated
using (public.is_mall_admin())
with check (public.is_mall_admin());

create or replace function public.has_mall_member_benefits()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select auth.uid() is not null and (
        public.is_mall_admin()
        or exists (select 1 from public.mall_members m where m.auth_user_id = auth.uid())
        or exists (select 1 from public.stores s where s.owner_id = auth.uid())
    );
$$;

revoke all on function public.has_mall_member_benefits() from public;
grant execute on function public.has_mall_member_benefits() to authenticated;

create or replace function public.add_member_walk_distance(p_meters numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    current_month date := date_trunc('month', now())::date;
    clean_meters numeric(12,2);
    total_meters numeric(12,2);
begin
    if not public.has_mall_member_benefits() then
        raise exception 'Esta funcion requiere una cuenta inscrita.';
    end if;

    clean_meters := round(coalesce(p_meters, 0)::numeric, 2);
    if clean_meters <= 0 or clean_meters > 250 then
        raise exception 'Distancia fuera del rango permitido.';
    end if;

    insert into public.member_monthly_activity (auth_user_id, month_start, meters_walked)
    values (auth.uid(), current_month, clean_meters)
    on conflict (auth_user_id, month_start) do update
    set meters_walked = public.member_monthly_activity.meters_walked + excluded.meters_walked,
        updated_at = now()
    returning meters_walked into total_meters;

    return jsonb_build_object(
        'month_start', current_month,
        'monthly_meters', total_meters
    );
end;
$$;

revoke all on function public.add_member_walk_distance(numeric) from public;
grant execute on function public.add_member_walk_distance(numeric) to authenticated;

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
            claim.claimed_at
        from public.mall_promotions promotion
        left join public.mall_promotion_claims claim
          on claim.promotion_id = promotion.id
         and claim.auth_user_id = auth.uid()
        where promotion.active
          and promotion.starts_at <= now()
          and (promotion.ends_at is null or promotion.ends_at > now())
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
    current_month date := date_trunc('month', now())::date;
    monthly_total numeric(12,2) := 0;
    claim_row public.mall_promotion_claims%rowtype;
begin
    if not public.has_mall_member_benefits() then
        raise exception 'Esta funcion requiere una cuenta inscrita.';
    end if;

    select * into promotion_row
    from public.mall_promotions promotion
    where promotion.id = p_promotion_id
      and promotion.active
      and promotion.starts_at <= now()
      and (promotion.ends_at is null or promotion.ends_at > now());

    if promotion_row.id is null then
        raise exception 'La promocion no esta activa.';
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

    insert into public.mall_promotion_claims (promotion_id, auth_user_id, evidence)
    values (promotion_row.id, auth.uid(), coalesce(p_evidence, '{}'::jsonb))
    on conflict (promotion_id, auth_user_id) do update
    set evidence = public.mall_promotion_claims.evidence || excluded.evidence
    returning * into claim_row;

    return jsonb_build_object(
        'claim_id', claim_row.id,
        'promotion_id', promotion_row.id,
        'reward_label', promotion_row.reward_label,
        'claimed_at', claim_row.claimed_at,
        'message', 'Beneficio registrado. La confirmacion sera enviada al correo de tu cuenta.'
    );
end;
$$;

revoke all on function public.claim_member_promotion(uuid, jsonb) from public;
grant execute on function public.claim_member_promotion(uuid, jsonb) to authenticated;

-- Plantilla inactiva. Un administrador puede definir fechas, premio y active=true.
insert into public.mall_promotions (
    title,
    description,
    promotion_type,
    reward_label,
    active
)
select
    'Encuentra el Globo Dorado',
    'Busca el Globo Dorado oculto en el mall y tocalo para registrar tu participacion.',
    'golden_balloon',
    'Cupon de descuento sorpresa',
    false
where not exists (
    select 1 from public.mall_promotions where promotion_type = 'golden_balloon'
);

commit;
