-- =====================================================
-- Phase 1: Instructor / Provider domain
-- - program_schedules, program_options, categories, program_categories
-- - providers, provider_members, provider_profiles
-- - slug_histories
-- - Phase 0에서 보류한 programs.provider_id, reservations.program_schedule_id 추가
-- =====================================================

-- =====================================================
-- ENUMs
-- =====================================================

create type public.program_schedule_status as enum (
  'active',
  'cancelled'
);

create type public.provider_role as enum (
  'owner',
  'manager',
  'instructor'
);

create type public.provider_member_status as enum (
  'active',
  'invited',
  'suspended'
);

-- =====================================================
-- providers
-- =====================================================

create table public.providers (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  business_type text,
  region_tags jsonb,
  phone text,
  email text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trigger_providers_updated_at
before update on public.providers
for each row execute function public.handle_updated_at();

-- =====================================================
-- provider_members
-- =====================================================

create table public.provider_members (
  id uuid primary key default gen_random_uuid(),

  provider_id uuid not null
    references public.providers(id) on delete cascade,

  user_id uuid not null
    references public.users(id) on delete cascade,

  role_in_provider public.provider_role not null,
  status public.provider_member_status not null default 'active',

  created_at timestamptz not null default now(),

  unique (provider_id, user_id)
);

create index idx_provider_members_provider_id on public.provider_members(provider_id);
create index idx_provider_members_user_id on public.provider_members(user_id);

-- =====================================================
-- provider_profiles
-- =====================================================

create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),

  provider_id uuid not null unique
    references public.providers(id) on delete cascade,

  display_name text not null,
  intro_short text,
  certifications_text text,
  story_text text,
  cover_image_urls jsonb not null default '[]'::jsonb,
  contact_links jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trigger_provider_profiles_updated_at
before update on public.provider_profiles
for each row execute function public.handle_updated_at();

-- =====================================================
-- programs.provider_id 추가 (Phase 0에서 보류)
-- =====================================================

alter table public.programs
  add column provider_id uuid references public.providers(id);

create index idx_programs_provider_id on public.programs(provider_id);

-- =====================================================
-- program_schedules
-- =====================================================

create table public.program_schedules (
  id uuid primary key default gen_random_uuid(),

  program_id uuid not null
    references public.programs(id) on delete cascade,

  start_at timestamptz not null,
  end_at timestamptz,

  capacity integer not null,
  remaining_capacity integer not null,

  status public.program_schedule_status not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (program_id, start_at),

  constraint schedule_capacity_non_negative
    check (capacity >= 0),
  constraint schedule_remaining_non_negative
    check (remaining_capacity >= 0),
  constraint schedule_remaining_le_capacity
    check (remaining_capacity <= capacity),
  constraint schedule_end_after_start
    check (end_at is null or end_at >= start_at)
);

create index idx_program_schedules_program_id on public.program_schedules(program_id);
create index idx_program_schedules_start_at on public.program_schedules(start_at);

create trigger trigger_program_schedules_updated_at
before update on public.program_schedules
for each row execute function public.handle_updated_at();

-- =====================================================
-- reservations.program_schedule_id 추가 (Phase 0에서 보류)
-- =====================================================

alter table public.reservations
  add column program_schedule_id uuid
    references public.program_schedules(id);

create index idx_reservations_program_schedule_id on public.reservations(program_schedule_id);

-- =====================================================
-- program_options
-- =====================================================

create table public.program_options (
  id uuid primary key default gen_random_uuid(),

  program_id uuid not null
    references public.programs(id) on delete cascade,

  name text not null,
  price_diff integer not null default 0,
  capacity integer,

  created_at timestamptz not null default now()
);

create index idx_program_options_program_id on public.program_options(program_id);

-- =====================================================
-- categories
-- =====================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),

  name text not null unique,
  slug text not null unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trigger_categories_updated_at
before update on public.categories
for each row execute function public.handle_updated_at();

-- =====================================================
-- program_categories (N:N)
-- =====================================================

create table public.program_categories (
  program_id uuid not null
    references public.programs(id) on delete cascade,

  category_id uuid not null
    references public.categories(id) on delete cascade,

  created_at timestamptz not null default now(),

  primary key (program_id, category_id)
);

create index idx_program_categories_category_id on public.program_categories(category_id);

-- =====================================================
-- slug_histories (강사 슬러그 변경 이력)
-- =====================================================

create table public.slug_histories (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.users(id) on delete cascade,

  slug text not null unique,

  created_at timestamptz not null default now()
);

create index idx_slug_histories_user_id on public.slug_histories(user_id);

-- =====================================================
-- RLS ENABLE
-- =====================================================

alter table public.providers          enable row level security;
alter table public.provider_members   enable row level security;
alter table public.provider_profiles  enable row level security;
alter table public.program_schedules  enable row level security;
alter table public.program_options    enable row level security;
alter table public.categories         enable row level security;
alter table public.program_categories enable row level security;
alter table public.slug_histories     enable row level security;

-- =====================================================
-- RLS POLICIES — providers
-- =====================================================

-- 소속 멤버는 자기 provider 조회
create policy "providers: member read"
on public.providers for select
using (
  exists (
    select 1 from public.provider_members
    where provider_id = providers.id
      and user_id = auth.uid()
      and status = 'active'
  )
);

-- 관리자 전체 접근
create policy "providers: admin all"
on public.providers for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — provider_members
-- =====================================================

-- 본인 멤버십 조회
create policy "provider_members: read own"
on public.provider_members for select
using (auth.uid() = user_id);

-- 관리자 전체 접근
create policy "provider_members: admin all"
on public.provider_members for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — provider_profiles
-- =====================================================

-- 공개된 프로필 누구나 조회
create policy "provider_profiles: public read published"
on public.provider_profiles for select
using (is_published = true);

-- 관리자 전체 접근
create policy "provider_profiles: admin all"
on public.provider_profiles for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — program_schedules
-- =====================================================

-- 공개 프로그램의 활성 스케줄 조회
create policy "program_schedules: public read active"
on public.program_schedules for select
using (
  status = 'active'
  and exists (
    select 1 from public.programs
    where id = program_id
      and status = 'published'
      and approval_status = 'approved'
      and deleted_at is null
  )
);

-- 관리자 전체 접근
create policy "program_schedules: admin all"
on public.program_schedules for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — program_options
-- =====================================================

-- 공개 프로그램의 옵션 조회
create policy "program_options: public read"
on public.program_options for select
using (
  exists (
    select 1 from public.programs
    where id = program_id
      and status = 'published'
      and approval_status = 'approved'
      and deleted_at is null
  )
);

-- 관리자 전체 접근
create policy "program_options: admin all"
on public.program_options for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — categories
-- =====================================================

-- 누구나 조회
create policy "categories: public read"
on public.categories for select
using (true);

-- 관리자 쓰기
create policy "categories: admin write"
on public.categories for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — program_categories
-- =====================================================

-- 누구나 조회 (어떤 프로그램이 어떤 카테고리에 속하는지)
create policy "program_categories: public read"
on public.program_categories for select
using (true);

-- 관리자 쓰기
create policy "program_categories: admin write"
on public.program_categories for all
using (public.is_admin());

-- =====================================================
-- RLS POLICIES — slug_histories
-- =====================================================

-- 본인 이력 조회
create policy "slug_histories: read own"
on public.slug_histories for select
using (auth.uid() = user_id);

-- 관리자 전체 접근
create policy "slug_histories: admin all"
on public.slug_histories for all
using (public.is_admin());
