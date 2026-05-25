-- =====================================================
-- Extensions
-- =====================================================

create extension if not exists "pgcrypto";

-- =====================================================
-- Updated At Trigger Function
-- =====================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================
-- ENUMS
-- =====================================================

create type public.program_status as enum (
  'draft',
  'published',
  'closed',
  'archived'
);

create type public.reservation_status as enum (
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'completed'
);

create type public.user_role as enum (
  'user',
  'operator',
  'super_admin'
);

-- =====================================================
-- USERS
-- [FIX] password_hash 제거 — Supabase Auth가 관리
-- =====================================================

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,

  email text not null unique,

  name text not null,
  nationality text,
  language text,
  phone text,

  role public.user_role not null default 'user',

  profile_image_url text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_users_email on public.users(email);
create index idx_users_role on public.users(role);
create index idx_users_nationality on public.users(nationality);

-- =====================================================
-- PROGRAMS
-- [FIX] start_date, end_date nullable — draft 저장 허용
-- =====================================================

create table public.programs (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  subtitle text,
  description text,

  thumbnail_url text,

  location text,
  address text,

  start_date date,
  end_date date,

  capacity integer not null default 0,
  current_reservation_count integer not null default 0,

  status public.program_status not null default 'draft',

  is_featured boolean not null default false,

  created_by uuid references public.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint capacity_non_negative
    check (capacity >= 0),

  constraint reservation_count_non_negative
    check (current_reservation_count >= 0),

  constraint reservation_count_limit
    check (current_reservation_count <= capacity)
);

create index idx_programs_status on public.programs(status);
create index idx_programs_start_date on public.programs(start_date);
create index idx_programs_featured on public.programs(is_featured);

-- =====================================================
-- PROGRAM IMAGES
-- =====================================================

create table public.program_images (
  id uuid primary key default gen_random_uuid(),

  program_id uuid not null
    references public.programs(id)
    on delete cascade,

  image_url text not null,

  sort_order integer not null default 0,

  created_at timestamptz not null default now()
);

create index idx_program_images_program_id
on public.program_images(program_id);

-- =====================================================
-- RESERVATIONS
-- [FIX] rejected_at 추가
-- =====================================================

create table public.reservations (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.users(id),

  program_id uuid not null
    references public.programs(id),

  participant_count integer not null default 1,

  reservation_status public.reservation_status
    not null
    default 'pending',

  memo text,

  approved_by uuid
    references public.users(id),

  approved_at   timestamptz,
  rejected_at   timestamptz,
  cancelled_at  timestamptz,
  completed_at  timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint participant_count_positive
    check (participant_count > 0)
);

create index idx_reservations_user_id    on public.reservations(user_id);
create index idx_reservations_program_id on public.reservations(program_id);
create index idx_reservations_status     on public.reservations(reservation_status);
create index idx_reservations_created_at on public.reservations(created_at);

-- =====================================================
-- NOTICES
-- =====================================================

create table public.notices (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  content text not null,

  is_published boolean not null default false,

  created_by uuid
    references public.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_notices_published on public.notices(is_published);

-- =====================================================
-- BANNERS
-- [FIX] deleted_at 추가 — soft delete 패턴 통일
-- =====================================================

create table public.banners (
  id uuid primary key default gen_random_uuid(),

  image_url text not null,
  link_url text,

  sort_order integer not null default 0,

  is_visible boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_banners_visible on public.banners(is_visible);

-- =====================================================
-- ADMIN ACTIVITY LOGS
-- =====================================================

create table public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),

  admin_id uuid not null
    references public.users(id),

  action text not null,

  target_type text,
  target_id uuid,

  description text,

  created_at timestamptz not null default now()
);

create index idx_admin_logs_admin_id on public.admin_activity_logs(admin_id);
create index idx_admin_logs_action   on public.admin_activity_logs(action);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

create trigger trigger_users_updated_at
before update on public.users
for each row execute function public.handle_updated_at();

create trigger trigger_programs_updated_at
before update on public.programs
for each row execute function public.handle_updated_at();

create trigger trigger_reservations_updated_at
before update on public.reservations
for each row execute function public.handle_updated_at();

create trigger trigger_notices_updated_at
before update on public.notices
for each row execute function public.handle_updated_at();

create trigger trigger_banners_updated_at
before update on public.banners
for each row execute function public.handle_updated_at();

-- =====================================================
-- AUTH SYNC
-- [FIX] auth.users 가입 시 public.users 자동 생성
-- =====================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =====================================================
-- RLS HELPER
-- [FIX] security definer로 RLS 재귀 문제 해결
-- =====================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role in ('operator', 'super_admin')
      and is_active = true
      and deleted_at is null
  );
$$;

-- =====================================================
-- RLS ENABLE
-- =====================================================

alter table public.users             enable row level security;
alter table public.programs          enable row level security;
alter table public.program_images    enable row level security;
alter table public.reservations      enable row level security;
alter table public.notices           enable row level security;
alter table public.banners           enable row level security;
alter table public.admin_activity_logs enable row level security;

-- =====================================================
-- RLS POLICIES — users
-- [FIX] 누락된 정책 추가
-- =====================================================

-- 본인 프로필 조회
create policy "users: read own"
on public.users for select
using (auth.uid() = id);

-- 관리자 전체 조회
create policy "users: admin read all"
on public.users for select
using (public.is_admin());

-- 관리자 수정 (역할 변경, 비활성화 등)
create policy "users: admin update"
on public.users for update
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — programs
-- =====================================================

-- 공개 프로그램 조회 (비로그인 포함)
create policy "programs: public read published"
on public.programs for select
using (
  status = 'published'
  and deleted_at is null
);

-- 관리자 전체 접근
create policy "programs: admin all"
on public.programs for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — program_images
-- [FIX] 누락된 정책 추가
-- =====================================================

-- 공개 프로그램의 이미지 조회
create policy "program_images: public read"
on public.program_images for select
using (
  exists (
    select 1 from public.programs
    where id = program_id
      and status = 'published'
      and deleted_at is null
  )
);

-- 관리자 전체 접근
create policy "program_images: admin all"
on public.program_images for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — reservations
-- [FIX] 누락된 정책 추가
-- =====================================================

-- 본인 예약 조회
create policy "reservations: read own"
on public.reservations for select
using (
  auth.uid() = user_id
  and deleted_at is null
);

-- 본인 예약 생성
create policy "reservations: insert own"
on public.reservations for insert
with check (auth.uid() = user_id);

-- 관리자 전체 접근
create policy "reservations: admin all"
on public.reservations for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — notices
-- =====================================================

-- 게시된 공지 조회
create policy "notices: public read published"
on public.notices for select
using (
  is_published = true
  and deleted_at is null
);

-- 관리자 전체 접근
create policy "notices: admin all"
on public.notices for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — banners
-- [FIX] 누락된 정책 추가
-- =====================================================

-- 노출 배너 조회
create policy "banners: public read visible"
on public.banners for select
using (
  is_visible = true
  and deleted_at is null
);

-- 관리자 전체 접근
create policy "banners: admin all"
on public.banners for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — admin_activity_logs
-- [FIX] 누락된 정책 추가
-- =====================================================

-- 관리자만 조회/기록
create policy "admin_logs: admin all"
on public.admin_activity_logs for all
using (public.is_admin());

-- =====================================================
-- STORAGE BUCKETS (Supabase Dashboard에서 생성)
-- =====================================================

-- program-images  : 프로그램 이미지 (public read)
-- banner-images   : 배너 이미지 (public read)
-- profile-images  : 프로필 이미지 (authenticated read)

-- =====================================================
-- SEED: 첫 번째 관리자 계정 설정 방법
-- =====================================================
--
-- 1. Supabase Auth에서 이메일/비밀번호로 계정 생성
--    (Dashboard → Authentication → Users → Invite user)
--
-- 2. 생성된 계정의 role을 super_admin으로 변경
--    (auth.users 생성 시 트리거로 public.users에 자동 삽입됨)
--
-- update public.users
-- set role = 'super_admin'
-- where email = 'admin@example.com';
