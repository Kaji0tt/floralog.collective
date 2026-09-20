create table if not exists public."PaymentTransaction" (
	id uuid primary key default gen_random_uuid(),
	provider text not null check (provider in ('paypal')),
	provider_order_id text not null,
	provider_capture_id text not null,
	payment_kind text not null check (payment_kind in ('donation', 'amber_purchase')),
	auth_id uuid references auth.users(id) on delete set null,
	gross_amount numeric(12, 2) not null check (gross_amount > 0),
	fee_amount numeric(12, 2) check (fee_amount is null or fee_amount >= 0),
	net_amount numeric(12, 2) check (net_amount is null or net_amount >= 0),
	currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
	product_code text,
	quantity integer check (quantity is null or quantity > 0),
	metadata jsonb not null default '{}'::jsonb,
	captured_at timestamptz not null,
	created_at timestamptz not null default now(),
	unique (provider, provider_order_id),
	unique (provider, provider_capture_id)
);

create index if not exists idx_payment_transaction_captured_at
	on public."PaymentTransaction" (captured_at desc);

create index if not exists idx_payment_transaction_kind_captured_at
	on public."PaymentTransaction" (payment_kind, captured_at desc);

create index if not exists idx_payment_transaction_auth_id_captured_at
	on public."PaymentTransaction" (auth_id, captured_at desc)
	where auth_id is not null;

alter table public."PaymentTransaction" enable row level security;

revoke all on table public."PaymentTransaction" from anon, authenticated;
grant select, insert on table public."PaymentTransaction" to service_role;

create or replace function public.prevent_payment_transaction_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	raise exception 'PaymentTransaction is append-only';
end;
$$;

revoke all on function public.prevent_payment_transaction_mutation() from public;

drop trigger if exists payment_transaction_prevent_update_delete
	on public."PaymentTransaction";

create trigger payment_transaction_prevent_update_delete
before update or delete on public."PaymentTransaction"
for each row execute function public.prevent_payment_transaction_mutation();

comment on table public."PaymentTransaction" is
	'Append-only ledger of externally verified payment captures. Client roles have no access.';

comment on column public."PaymentTransaction".metadata is
	'Non-sensitive provider context only. Never store payer email, name, address, or raw provider payloads.';

create table if not exists public."AiKpiSnapshotRequest" (
	id uuid primary key default gen_random_uuid(),
	request_bucket timestamptz not null unique,
	requested_at timestamptz not null default now()
);

alter table public."AiKpiSnapshotRequest" enable row level security;
revoke all on table public."AiKpiSnapshotRequest" from anon, authenticated;
grant select, insert on table public."AiKpiSnapshotRequest" to service_role;

create or replace function public.ai_get_kpi_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
	with boundaries as (
		select
			now() as generated_at,
			now() - interval '24 hours' as since_24h,
			now() - interval '7 days' as since_7d,
			now() - interval '30 days' as since_30d,
			date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' as month_start
	), discovery_metrics as (
		select
			count(distinct discovery.auth_id) filter (
				where discovery.discovered_date >= boundaries.since_24h
			)::integer as dau,
			count(distinct discovery.auth_id) filter (
				where discovery.discovered_date >= boundaries.since_7d
			)::integer as wau,
			count(distinct discovery.auth_id) filter (
				where discovery.discovered_date >= boundaries.since_30d
			)::integer as mau
		from public."UserPlantDiscovery" discovery
		cross join boundaries
		where discovery.auth_id is not null
			and discovery.discovered_date >= boundaries.since_30d
	), payment_metrics as (
		select
			coalesce(sum(payment.gross_amount) filter (
				where payment.captured_at >= boundaries.month_start
			), 0)::numeric(12, 2) as revenue_mtd_eur,
			coalesce(sum(payment.gross_amount) filter (
				where payment.captured_at >= boundaries.since_30d
			), 0)::numeric(12, 2) as revenue_30d_eur,
			coalesce(sum(payment.gross_amount) filter (
				where payment.captured_at >= boundaries.since_30d
					and payment.payment_kind = 'donation'
			), 0)::numeric(12, 2) as donation_revenue_30d_eur,
			coalesce(sum(payment.gross_amount) filter (
				where payment.captured_at >= boundaries.since_30d
					and payment.payment_kind = 'amber_purchase'
			), 0)::numeric(12, 2) as amber_revenue_30d_eur,
			coalesce(avg(payment.gross_amount) filter (
				where payment.captured_at >= boundaries.since_30d
					and payment.payment_kind = 'donation'
			), 0)::numeric(12, 2) as average_donation_eur,
			count(*) filter (
				where payment.captured_at >= boundaries.since_30d
			)::integer as transaction_count_30d,
			count(*) filter (
				where payment.captured_at >= boundaries.since_30d
					and payment.payment_kind = 'donation'
			)::integer as donation_captures_30d
		from public."PaymentTransaction" payment
		cross join boundaries
		where payment.currency_code = 'EUR'
	), action_metrics as (
		select
			count(*) filter (where event.event_name = 'donation_page_view')::integer
				as donation_page_views_30d,
			count(*) filter (where event.event_name = 'donation_order_created')::integer
				as donation_orders_30d,
			count(*) filter (
				where event.event_name in (
					'bottomnav_social',
					'friend_request_sent',
					'collection_followed',
					'scan_shared'
				)
			)::integer as community_actions_30d
		from public."UserActionEvent" event
		cross join boundaries
		where event.created_at >= boundaries.since_30d
	), referral_metrics as (
		select count(*)::integer as referrals_completed_30d
		from public."Referral" referral
		cross join boundaries
		where lower(coalesce(referral.status, '')) in ('completed', 'accepted')
			and coalesce(referral.updated_date, referral.created_date) >= boundaries.since_30d
	)
	select jsonb_build_object(
		'generated_at', boundaries.generated_at,
		'revenue_mtd_eur', payment_metrics.revenue_mtd_eur,
		'revenue_30d_eur', payment_metrics.revenue_30d_eur,
		'donation_revenue_30d_eur', payment_metrics.donation_revenue_30d_eur,
		'amber_revenue_30d_eur', payment_metrics.amber_revenue_30d_eur,
		'average_donation_eur', payment_metrics.average_donation_eur,
		'transaction_count_30d', payment_metrics.transaction_count_30d,
		'donation_page_views_30d', action_metrics.donation_page_views_30d,
		'donation_orders_30d', action_metrics.donation_orders_30d,
		'donation_captures_30d', payment_metrics.donation_captures_30d,
		'dau', discovery_metrics.dau,
		'wau', discovery_metrics.wau,
		'mau', discovery_metrics.mau,
		'referrals_completed_30d', referral_metrics.referrals_completed_30d,
		'community_actions_30d', action_metrics.community_actions_30d,
		'suppressed_small_cohorts', true
	)
	from boundaries
	cross join discovery_metrics
	cross join payment_metrics
	cross join action_metrics
	cross join referral_metrics;
$$;

revoke all on function public.ai_get_kpi_snapshot() from public, anon, authenticated;
grant execute on function public.ai_get_kpi_snapshot() to service_role;
