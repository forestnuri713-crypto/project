-- =====================================================
-- Phase 3: Payment domain
-- - payments (PortOne 결제)
-- - payment_webhook_events (웹훅 idempotency)
-- - payment_settlements (결제별 정산 분배)
-- - payouts (송금 이력)
--
-- 보안 원칙:
-- - 결제 데이터는 클라이언트에서 직접 수정 불가
-- - INSERT/UPDATE/DELETE는 service_role (Edge Function/서버) 전용
-- - SELECT는 본인 예약 결제 + 관리자만 허용
-- =====================================================

-- =====================================================
-- ENUMs
-- =====================================================

create type public.payment_method as enum (
  'kakao_pay',
  'toss_pay'
);

create type public.payment_status as enum (
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded',
  'partial_refund'
);

create type public.webhook_provider as enum (
  'portone'
);

create type public.webhook_event_status as enum (
  'received',
  'processed',
  'ignored',
  'failed'
);

create type public.payment_settlement_status as enum (
  'pending',
  'confirmed',
  'paid'
);

create type public.payout_status as enum (
  'initiated',
  'success',
  'failed'
);

-- =====================================================
-- payments
-- =====================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),

  reservation_id uuid not null unique
    references public.reservations(id),

  merchant_uid text not null unique,
  method public.payment_method not null,
  portone_payment_id text not null unique,

  amount integer not null,
  status public.payment_status not null default 'pending',

  paid_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,

  refunded_amount integer not null default 0,
  refunded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint amount_positive
    check (amount > 0),
  constraint refunded_amount_non_negative
    check (refunded_amount >= 0),
  constraint refunded_amount_le_amount
    check (refunded_amount <= amount)
);

create index idx_payments_status on public.payments(status);
create index idx_payments_paid_at on public.payments(paid_at);

create trigger trigger_payments_updated_at
before update on public.payments
for each row execute function public.handle_updated_at();

-- =====================================================
-- payment_webhook_events (idempotency)
-- =====================================================

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),

  provider public.webhook_provider not null,
  event_key text not null,
  merchant_uid text,
  event_type text not null,

  status public.webhook_event_status not null default 'received',

  raw_body jsonb,

  received_at timestamptz not null default now(),
  processed_at timestamptz,

  created_at timestamptz not null default now(),

  unique (provider, event_key)
);

create index idx_webhook_events_merchant_uid on public.payment_webhook_events(merchant_uid);
create index idx_webhook_events_received_at on public.payment_webhook_events(received_at);
create index idx_webhook_events_status on public.payment_webhook_events(status);

-- =====================================================
-- payment_settlements (결제별 정산 분배)
-- =====================================================

create table public.payment_settlements (
  id uuid primary key default gen_random_uuid(),

  reservation_id uuid not null unique
    references public.reservations(id),

  payment_id uuid not null unique
    references public.payments(id),

  gross_amount integer not null,
  platform_rate numeric(5, 4) not null,
  platform_fee integer not null,
  net_amount integer not null,

  status public.payment_settlement_status not null default 'pending',

  confirmed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint gross_amount_positive
    check (gross_amount > 0),
  constraint platform_rate_range
    check (platform_rate >= 0 and platform_rate <= 1),
  constraint platform_fee_non_negative
    check (platform_fee >= 0),
  constraint net_amount_non_negative
    check (net_amount >= 0),
  constraint settlement_amounts_consistent
    check (platform_fee + net_amount = gross_amount)
);

create index idx_payment_settlements_status on public.payment_settlements(status);

create trigger trigger_payment_settlements_updated_at
before update on public.payment_settlements
for each row execute function public.handle_updated_at();

-- =====================================================
-- payouts (송금 이력)
-- =====================================================

create table public.payouts (
  id uuid primary key default gen_random_uuid(),

  settlement_id uuid not null
    references public.payment_settlements(id),

  payout_key text not null unique,
  amount integer not null,

  status public.payout_status not null default 'initiated',

  executed_at timestamptz,

  created_at timestamptz not null default now(),

  constraint payout_amount_positive
    check (amount > 0)
);

create index idx_payouts_settlement_id on public.payouts(settlement_id);
create index idx_payouts_status on public.payouts(status);

-- =====================================================
-- RLS ENABLE
-- =====================================================

alter table public.payments               enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.payment_settlements    enable row level security;
alter table public.payouts                enable row level security;

-- =====================================================
-- RLS POLICIES — payments
-- 쓰기는 RLS 정책 없음(=anon/authenticated 모두 차단). service_role만 우회.
-- =====================================================

-- 본인 예약의 결제만 조회
create policy "payments: read own"
on public.payments for select
using (
  exists (
    select 1 from public.reservations
    where id = reservation_id
      and user_id = auth.uid()
  )
);

-- 관리자 전체 조회
create policy "payments: admin read"
on public.payments for select
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — payment_webhook_events
-- 클라이언트 접근 완전 차단. service_role만 사용.
-- 관리자도 디버깅 목적으로만 조회 가능.
-- =====================================================

create policy "webhook_events: admin read"
on public.payment_webhook_events for select
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — payment_settlements
-- 본인 결제 정산만 조회 + 관리자 전체.
-- =====================================================

create policy "payment_settlements: read own"
on public.payment_settlements for select
using (
  exists (
    select 1 from public.payments p
    join public.reservations r on r.id = p.reservation_id
    where p.id = payment_id
      and r.user_id = auth.uid()
  )
);

create policy "payment_settlements: admin read"
on public.payment_settlements for select
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — payouts
-- 관리자 전체 조회만. 일반 사용자는 차단.
-- =====================================================

create policy "payouts: admin read"
on public.payouts for select
using (public.is_admin());
