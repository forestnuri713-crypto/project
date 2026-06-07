-- =====================================================
-- Phase 4: Settlement / Bulk Cancel / Guide Templates
-- - settlements (강사별 기간 정산)
-- - bulk_cancel_jobs + bulk_cancel_job_items
-- - guide_templates (4종 가이드)
-- =====================================================

-- =====================================================
-- ENUMs
-- =====================================================

create type public.settlement_status as enum (
  'pending',
  'confirmed',
  'paid'
);

create type public.bulk_cancel_job_status as enum (
  'pending',
  'running',
  'completed',
  'completed_with_errors',
  'failed'
);

create type public.bulk_cancel_item_result as enum (
  'success',
  'failed',
  'skipped'
);

create type public.guide_kind as enum (
  'safety',
  'payment',
  'cancel',
  'inquiry'
);

-- =====================================================
-- settlements (강사별 기간 정산)
-- =====================================================

create table public.settlements (
  id uuid primary key default gen_random_uuid(),

  instructor_id uuid not null
    references public.users(id),

  period_start timestamptz not null,
  period_end timestamptz not null,

  gross_amount integer not null,
  refund_amount integer not null,
  platform_fee integer not null,
  notification_cost integer not null,
  b2b_commission integer not null,
  net_amount integer not null,

  status public.settlement_status not null default 'pending',

  paid_at timestamptz,
  memo text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (instructor_id, period_start, period_end),

  constraint settlement_period_valid
    check (period_end > period_start),
  constraint gross_non_negative check (gross_amount >= 0),
  constraint refund_non_negative check (refund_amount >= 0),
  constraint platform_fee_non_negative check (platform_fee >= 0),
  constraint notification_cost_non_negative check (notification_cost >= 0),
  constraint b2b_commission_non_negative check (b2b_commission >= 0)
);

create index idx_settlements_instructor_id on public.settlements(instructor_id);
create index idx_settlements_status on public.settlements(status);
create index idx_settlements_period_end on public.settlements(period_end);

create trigger trigger_settlements_updated_at
before update on public.settlements
for each row execute function public.handle_updated_at();

-- =====================================================
-- bulk_cancel_jobs (관리자 일괄 취소 작업)
-- session_id는 Prisma 명명이지만 실제로는 program(=프로그램 세션) 참조.
-- =====================================================

create table public.bulk_cancel_jobs (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references public.programs(id),

  reason varchar(200) not null,
  mode text not null,

  status public.bulk_cancel_job_status not null default 'pending',

  total_targets integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,

  created_by_admin_user_id uuid not null
    references public.users(id),

  started_at timestamptz,
  finished_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint total_targets_non_negative check (total_targets >= 0),
  constraint success_count_non_negative check (success_count >= 0),
  constraint failed_count_non_negative check (failed_count >= 0),
  constraint skipped_count_non_negative check (skipped_count >= 0)
);

create index idx_bulk_cancel_jobs_session_id on public.bulk_cancel_jobs(session_id);
create index idx_bulk_cancel_jobs_status on public.bulk_cancel_jobs(status);
create index idx_bulk_cancel_jobs_admin on public.bulk_cancel_jobs(created_by_admin_user_id);

create trigger trigger_bulk_cancel_jobs_updated_at
before update on public.bulk_cancel_jobs
for each row execute function public.handle_updated_at();

-- =====================================================
-- bulk_cancel_job_items (잡 항목별 결과)
-- =====================================================

create table public.bulk_cancel_job_items (
  id uuid primary key default gen_random_uuid(),

  job_id uuid not null
    references public.bulk_cancel_jobs(id) on delete cascade,

  reservation_id uuid not null
    references public.reservations(id),

  result public.bulk_cancel_item_result not null default 'failed',

  failure_code text,
  failure_message text,

  attempted_at timestamptz not null default now(),

  refunded_amount integer,
  notification_sent boolean not null default false,

  unique (job_id, reservation_id),

  constraint item_refunded_non_negative
    check (refunded_amount is null or refunded_amount >= 0)
);

create index idx_bulk_cancel_job_items_job_id on public.bulk_cancel_job_items(job_id);
create index idx_bulk_cancel_job_items_reservation_id on public.bulk_cancel_job_items(reservation_id);

-- =====================================================
-- guide_templates (4종 안내 템플릿)
-- =====================================================

create table public.guide_templates (
  id uuid primary key default gen_random_uuid(),

  kind public.guide_kind not null unique,
  content text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trigger_guide_templates_updated_at
before update on public.guide_templates
for each row execute function public.handle_updated_at();

-- =====================================================
-- RLS ENABLE
-- =====================================================

alter table public.settlements            enable row level security;
alter table public.bulk_cancel_jobs       enable row level security;
alter table public.bulk_cancel_job_items  enable row level security;
alter table public.guide_templates        enable row level security;

-- =====================================================
-- RLS POLICIES — settlements
-- 본인 강사 정산만 조회 + 관리자 전체. 쓰기는 service_role 전용.
-- =====================================================

create policy "settlements: read own"
on public.settlements for select
using (auth.uid() = instructor_id);

create policy "settlements: admin read"
on public.settlements for select
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — bulk_cancel_jobs / items
-- 관리자 전용. 일반 사용자는 차단.
-- =====================================================

create policy "bulk_cancel_jobs: admin all"
on public.bulk_cancel_jobs for all
using (public.is_admin());

create policy "bulk_cancel_job_items: admin all"
on public.bulk_cancel_job_items for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — guide_templates
-- 조회는 누구나 (강사가 프로그램 작성 시 참조), 쓰기는 관리자.
-- =====================================================

create policy "guide_templates: public read"
on public.guide_templates for select
using (true);

create policy "guide_templates: admin write"
on public.guide_templates for all
using (public.is_admin());

-- =====================================================
-- SEED: 가이드 템플릿 기본값
-- 기존 admin 앱이 이 4종을 기대하므로 빈 row를 미리 생성.
-- =====================================================

insert into public.guide_templates (kind, content) values
  ('safety', ''),
  ('payment', ''),
  ('cancel', ''),
  ('inquiry', '')
on conflict (kind) do nothing;
