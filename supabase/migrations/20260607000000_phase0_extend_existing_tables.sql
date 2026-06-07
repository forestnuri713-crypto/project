-- =====================================================
-- Phase 0: Extend existing tables (users, programs, reservations)
-- Prisma 도메인(강사, 가이드, 키워드 등)을 새 Supabase 스타일로 포팅
--
-- 사전 결정 사항:
-- - user_role: user/operator/super_admin 유지, 강사 여부는 instructor_status 컬럼으로
-- - reservation_status: 기존 approved 의미 유지 (관리자 승인)
-- - gallery vs program_images: 별도 개념으로 유지 (Phase 2에서 gallery 추가)
-- =====================================================

-- =====================================================
-- New ENUMs
-- =====================================================

create type public.instructor_status as enum (
  'none',
  'applied',
  'approved',
  'rejected'
);

create type public.approval_status as enum (
  'pending_review',
  'approved',
  'rejected'
);

-- =====================================================
-- users: 강사/카카오/슬러그/캐시 필드 추가
-- =====================================================

alter table public.users
  add column kakao_id text unique,
  add column fcm_token text,
  add column instructor_status public.instructor_status not null default 'none',
  add column instructor_status_reason text,
  add column message_cash_balance integer not null default 0,
  add column certifications jsonb not null default '[]'::jsonb,
  add column slug text unique,
  add column slug_change_count integer not null default 0,
  add constraint message_cash_non_negative
    check (message_cash_balance >= 0);

create index idx_users_kakao_id on public.users(kakao_id);
create index idx_users_instructor_status on public.users(instructor_status);
create index idx_users_slug on public.users(slug);

-- =====================================================
-- programs: 강사/가격/일정/승인/가이드/평점 등 추가
-- - instructor_id는 nullable (기존 row 호환). 이후 운영 데이터 정리 후 NOT NULL 전환 검토.
-- - provider_id 컬럼은 Phase 1(providers 테이블 생성 시) 추가.
-- - program_schedule_id 컬럼은 Phase 1(program_schedules 테이블 생성 시) 추가.
-- =====================================================

alter table public.programs
  add column instructor_id uuid references public.users(id),
  add column price integer not null default 0,
  add column latitude double precision,
  add column longitude double precision,
  add column min_age integer not null default 0,
  add column schedule_at timestamptz,
  add column approval_status public.approval_status not null default 'pending_review',
  add column rejection_reason text,
  add column is_b2b boolean not null default false,
  add column safety_guide text,
  add column payment_guide text,
  add column cancel_guide text,
  add column inquiry_guide text,
  add column insurance_covered boolean not null default false,
  add column keywords text[] not null default '{}',
  add column cover_image_key text,
  add column booking_deadline_days integer,
  add column rating_avg numeric(3, 2) not null default 0,
  add column review_count integer not null default 0,
  add constraint price_non_negative
    check (price >= 0),
  add constraint min_age_non_negative
    check (min_age >= 0),
  add constraint rating_avg_range
    check (rating_avg >= 0 and rating_avg <= 5),
  add constraint review_count_non_negative
    check (review_count >= 0),
  add constraint booking_deadline_non_negative
    check (booking_deadline_days is null or booking_deadline_days >= 0);

create index idx_programs_instructor_id on public.programs(instructor_id);
create index idx_programs_schedule_at on public.programs(schedule_at);
create index idx_programs_approval_status on public.programs(approval_status);

-- =====================================================
-- programs RLS 갱신
-- 기존 정책 "programs: public read published"는 status='published'만 검사.
-- approval_status='approved'까지 충족해야 공개되도록 강화.
-- =====================================================

drop policy if exists "programs: public read published" on public.programs;

create policy "programs: public read published"
on public.programs for select
using (
  status = 'published'
  and approval_status = 'approved'
  and deleted_at is null
);

-- =====================================================
-- reservations: 결제 금액 추가
-- - program_schedule_id는 Phase 1(program_schedules 생성 시) 추가.
-- =====================================================

alter table public.reservations
  add column total_price integer not null default 0,
  add constraint total_price_non_negative
    check (total_price >= 0);

-- =====================================================
-- 검증 쿼리 (실행 후 수동 확인용)
-- =====================================================
--
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name in ('users','programs','reservations')
-- order by table_name, ordinal_position;
--
-- select tablename, policyname, cmd, qual
-- from pg_policies
-- where schemaname = 'public' and tablename = 'programs';
