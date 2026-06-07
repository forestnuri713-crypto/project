-- =====================================================
-- Phase 2: Reviews + Operations
-- - reviews (프로그램 후기)
-- - attendances (QR 출석)
-- - gallery (수업 후 사진, program_images와 별도)
-- - notifications (인앱 알림)
-- =====================================================

-- =====================================================
-- ENUMs
-- =====================================================

create type public.review_status as enum (
  'visible',
  'hidden'
);

create type public.attendance_status as enum (
  'attended',
  'no_show'
);

create type public.notification_type as enum (
  'pre_activity',
  'gallery_uploaded',
  'program_approved',
  'program_rejected',
  'settlement_created',
  'instructor_approved',
  'instructor_rejected',
  'reservation_bulk_cancelled'
);

-- =====================================================
-- reviews
-- =====================================================

create table public.reviews (
  id uuid primary key default gen_random_uuid(),

  program_id uuid not null
    references public.programs(id) on delete cascade,

  reservation_id uuid not null unique
    references public.reservations(id) on delete cascade,

  parent_user_id uuid not null
    references public.users(id) on delete cascade,

  rating integer not null,
  comment varchar(300) not null,

  status public.review_status not null default 'visible',

  edited_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rating_range
    check (rating >= 1 and rating <= 5)
);

create index idx_reviews_program_id on public.reviews(program_id);
create index idx_reviews_parent_user_id on public.reviews(parent_user_id);
create index idx_reviews_status on public.reviews(status);

create trigger trigger_reviews_updated_at
before update on public.reviews
for each row execute function public.handle_updated_at();

-- =====================================================
-- attendances
-- =====================================================

create table public.attendances (
  id uuid primary key default gen_random_uuid(),

  reservation_id uuid not null unique
    references public.reservations(id) on delete cascade,

  status public.attendance_status not null default 'no_show',

  qr_code text not null unique,

  checked_at timestamptz,
  checked_by uuid references public.users(id),

  checkin_latitude double precision,
  checkin_longitude double precision,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_attendances_checked_by on public.attendances(checked_by);
create index idx_attendances_status on public.attendances(status);

create trigger trigger_attendances_updated_at
before update on public.attendances
for each row execute function public.handle_updated_at();

-- =====================================================
-- gallery (수업 후 사진 — program_images와 별도 개념)
-- =====================================================

create table public.gallery (
  id uuid primary key default gen_random_uuid(),

  program_id uuid not null
    references public.programs(id) on delete cascade,

  image_key text not null,
  thumbnail_key text not null,

  uploaded_by uuid not null
    references public.users(id) on delete cascade,

  created_at timestamptz not null default now()
);

create index idx_gallery_program_id on public.gallery(program_id);
create index idx_gallery_uploaded_by on public.gallery(uploaded_by);

-- =====================================================
-- notifications
-- =====================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.users(id) on delete cascade,

  type public.notification_type not null,
  title text not null,
  body text not null,

  is_read boolean not null default false,
  data jsonb,

  created_at timestamptz not null default now()
);

create index idx_notifications_user_id_created_at
on public.notifications(user_id, created_at desc);

create index idx_notifications_user_unread
on public.notifications(user_id)
where is_read = false;

-- =====================================================
-- RLS ENABLE
-- =====================================================

alter table public.reviews        enable row level security;
alter table public.attendances    enable row level security;
alter table public.gallery        enable row level security;
alter table public.notifications  enable row level security;

-- =====================================================
-- RLS POLICIES — reviews
-- =====================================================

-- 노출 후기는 누구나 조회
create policy "reviews: public read visible"
on public.reviews for select
using (status = 'visible');

-- 본인 후기 생성
create policy "reviews: insert own"
on public.reviews for insert
with check (auth.uid() = parent_user_id);

-- 본인 후기 수정
create policy "reviews: update own"
on public.reviews for update
using (auth.uid() = parent_user_id);

-- 관리자 전체 접근
create policy "reviews: admin all"
on public.reviews for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — attendances
-- =====================================================

-- 본인 예약의 출석 조회
create policy "attendances: read own"
on public.attendances for select
using (
  exists (
    select 1 from public.reservations
    where id = reservation_id
      and user_id = auth.uid()
  )
);

-- 관리자 전체 접근
create policy "attendances: admin all"
on public.attendances for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — gallery
-- =====================================================

-- 공개 프로그램의 갤러리는 누구나 조회
create policy "gallery: public read"
on public.gallery for select
using (
  exists (
    select 1 from public.programs
    where id = program_id
      and status = 'published'
      and approval_status = 'approved'
      and deleted_at is null
  )
);

-- 업로더 본인은 조회
create policy "gallery: read own upload"
on public.gallery for select
using (auth.uid() = uploaded_by);

-- 업로더 본인 삽입
create policy "gallery: insert own"
on public.gallery for insert
with check (auth.uid() = uploaded_by);

-- 관리자 전체 접근
create policy "gallery: admin all"
on public.gallery for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — notifications
-- =====================================================

-- 본인 알림 조회
create policy "notifications: read own"
on public.notifications for select
using (auth.uid() = user_id);

-- 본인 알림 수정 (is_read 토글)
create policy "notifications: update own"
on public.notifications for update
using (auth.uid() = user_id);

-- 관리자 전체 접근 (발송용)
create policy "notifications: admin all"
on public.notifications for all
using (public.is_admin());
