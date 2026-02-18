# 숲똑 (SoopTalk) — 프로젝트 현황

> 최종 업데이트: 2026-02-18
> 빌드 상태: `tsc --noEmit` PASS (server + admin)
> 커밋: `5a2629c` (main)

---

## 완료된 Phase 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 0 | 모노레포 초기 세팅 (Turborepo + pnpm) | 완료 |
| Phase 1 | Auth + 프로그램 + 예약 MVP | 완료 |
| Phase 2 | 결제 모듈 (PortOne) + 출석 체크 | 완료 |
| Phase 3 | 알림 자동화 (FCM/Cron) + 사진첩 (S3/sharp) | 완료 |
| Phase 4 | 정산 시스템 + 어드민 API | 완료 |
| Phase 5 | 어드민 대시보드 (프론트엔드) | **완료 (Read-only 1차)** |

---

## Sprint 진행 현황

| Sprint | 내용 | 상태 |
|--------|------|------|
| Sprint 6 | 리뷰 시스템 | 완료 |
| Sprint 7 | 우천 일괄 취소 (Bulk Cancel) | 완료 |
| Sprint 8 | Hardening (ApiError 표준화, 도메인 유틸, 로깅) | 완료 |
| Sprint 9 | 카테고리 & 디스커버리 레이어 | 완료 |
| Sprint 10 | 예약 정합성 & 동시성 강화 | 완료 |
| Sprint 11 | Payment Webhook 2-layer Idempotency | 완료 |
| Sprint 12 | ProgramSchedule 도입 (회차 분리) | 완료 |
| Sprint 13 | Atomic Schedule Capacity (remaining_capacity) | 완료 |
| Sprint 14 | Admin Readiness Hardening | 완료 |
| Sprint 15 | Structured Error & Observability | 완료 |
| Sprint 16 | Admin Dashboard UI Foundation | 완료 |
| Sprint 17 | Admin Pagination + Metrics Foundation | 완료 |
| Sprint 18 | Dashboard Drill-down + Metrics Expansion (Read-only) | 완료 |
| Sprint 19 | Admin Visibility + Observability | 완료 |
| Sprint 20 M1 | Public Instructor Profile Skeleton | 완료 |
| Sprint 20 M2 | Slug Strategy | 완료 |
| Sprint 20 M3 | One-Time Slug Update | 완료 |
| Sprint 20 M4 | Slug History Redirects | 완료 |
| Sprint 21 M1 | SEO Meta Foundation (apps/web / instructors slug meta) | 완료 |
| Sprint 23 | Public Instructor List API (apps/server, cursor pagination) | 완료 |

---

## Phase 4 이후 적용된 변경 사항

### 1. 인증 100% 카카오 로그인
- 로컬 회원가입/로그인 제거, `POST /auth/kakao` 단일 인증
- 첫 가입 시 `role` 선택 가능

### 2. 위치+시간 자동 출석 체크
- `POST /attendance/auto-checkin` — Haversine 거리(≤100m) + 시간 범위(±30분) 검증

### 3. 정산일 목요일로 변경
- `@Cron('0 2 * * 4')` — 매주 목요일 02:00

### 4. 알림 비용 선충전 캐시
- `messageCashBalance` 필드, 유료 알림 발송 전 잔액 차감, 부족 시 차단

### 5. 업체 미니홈페이지 (Provider Mini Homepage)
- `Provider`, `ProviderMember`, `ProviderProfile` 모델 신규
- 5개 엔드포인트: 프로필 upsert, 커버 이미지 presign, 공개 전환, 공개 조회, 멤버 목록

### 6. 강사 신청 + 신뢰 UI + 프로필 자동 구성 ← **최신**

아래에 상세 기술.

---

## 최신 작업: 강사 신청 + 신뢰 UI + 프로필 자동 구성

### 개요
업체 미니홈페이지 기본 API 위에 3가지를 추가:
1. **강사 가입 상태 관리** — APPLIED → APPROVED / REJECTED, 어드민 승인 후에만 프로그램 등록 가능
2. **신뢰 UI 요소** — 강사 자격/경력 뱃지(certifications), 프로그램별 안전 가이드/보험 여부
3. **프로필 프로그램/갤러리 자동 구성** — 기존 Program/Gallery를 소속 강사 instructor_id 기준으로 조회

### Shared 패키지 변경
| 파일 | 변경 |
|------|------|
| `types/user.ts` | `InstructorStatus` enum (NONE, APPLIED, APPROVED, REJECTED), `InstructorCertification` interface, User에 3개 필드 추가 |
| `types/program.ts` | `safetyGuide?`, `insuranceCovered` 추가 |
| `types/notification.ts` | `INSTRUCTOR_APPROVED`, `INSTRUCTOR_REJECTED` 추가 |
| `constants/index.ts` | `PROVIDER_GALLERY_PREVIEW_MAX_COUNT=20`, `INSTRUCTOR_CERTIFICATIONS_MAX_COUNT=10`, `PROGRAM_SAFETY_GUIDE_MAX_LENGTH=500` |
| `index.ts` | 새 타입/상수 re-export |

### Prisma 스키마 변경
- `InstructorStatus` enum 신규 (NONE, APPLIED, APPROVED, REJECTED)
- `NotificationType`에 `INSTRUCTOR_APPROVED`, `INSTRUCTOR_REJECTED` 추가
- `User` 모델: `instructorStatus` (default NONE), `instructorStatusReason?`, `certifications` (Json default [])
- `Program` 모델: `safetyGuide?`, `insuranceCovered` (default false)

### 마이그레이션
- 파일: `migrations/20260211000000_add_instructor_status_and_safety_fields/migration.sql`
- 기존 `role = 'INSTRUCTOR'` 사용자를 `instructor_status = 'APPROVED'`로 일괄 업데이트
- 적용 명령: `npx prisma migrate deploy`

### 신규/수정 API 엔드포인트 (5개 추가)

| Method | Endpoint | Auth | Role | 설명 |
|--------|----------|------|------|------|
| POST | `/auth/apply-instructor` | JWT | - | 강사 신청 (PARENT→INSTRUCTOR, status=APPLIED) |
| GET | `/admin/instructors` | JWT | ADMIN | 강사 신청 목록 (필터/페이지네이션) |
| PATCH | `/admin/instructors/:id/approve` | JWT | ADMIN | 강사 승인 + FCM 알림 |
| PATCH | `/admin/instructors/:id/reject` | JWT | ADMIN | 강사 거절 (사유 필수) + FCM 알림 |
| PATCH | `/admin/instructors/:id/certifications` | JWT | ADMIN | 인증 뱃지 수정 (최대 10개) |

### 기존 API 변경

| 엔드포인트 | 변경 |
|-----------|------|
| `POST /programs` | `instructorStatus !== 'APPROVED'`이면 403 Forbidden |
| `POST /auth/kakao` | role=INSTRUCTOR 가입 시 `instructorStatus=APPLIED` 자동 설정 |
| `GET /admin/dashboard/stats` | `pendingInstructors` 카운트 추가 |
| `GET /providers/:id/profile` | 프로그램/갤러리 자동 구성 + 멤버 뱃지 포함 |

### 변경 파일 목록 (20개)

**신규 (4개):**
- `apps/server/src/admin/dto/admin-query-instructors.dto.ts`
- `apps/server/src/admin/dto/reject-instructor.dto.ts`
- `apps/server/src/admin/dto/update-certifications.dto.ts`
- `apps/server/src/prisma/migrations/20260211000000_.../migration.sql`

**수정 (16개):**
- `packages/shared/src/types/user.ts`
- `packages/shared/src/types/program.ts`
- `packages/shared/src/types/notification.ts`
- `packages/shared/src/constants/index.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/prisma/schema.prisma`
- `apps/server/src/auth/auth.service.ts`
- `apps/server/src/auth/auth.controller.ts`
- `apps/server/src/admin/admin.service.ts`
- `apps/server/src/admin/admin.controller.ts`
- `apps/server/src/programs/programs.service.ts`
- `apps/server/src/programs/dto/create-program.dto.ts`
- `apps/server/src/providers/providers.service.ts`
- `CONTEXT.txt`
- `PHASE2_TODO.txt`
- `status.md`

### 핵심 설계 결정

| 결정 | 이유 |
|------|------|
| InstructorStatus를 User에 직접 (별도 테이블 X) | 1:1 관계, 단순 상태 추적 |
| certifications → Json 컬럼 | 최대 10개 소규모 배열, 별도 테이블 불필요 |
| REJECTED 후 재신청 허용 | 서류 보완 후 재도전 UX |
| 프로필 프로그램은 OR 조건 (providerId OR memberInstructorId) | 기존 FK + 멤버 기반 자동 수집 모두 커버 |
| Gallery는 프로그램 기반 자동 조회 (최근 20개) | 별도 업로드 없이 기존 데이터 활용 |
| 기존 INSTRUCTOR → APPROVED 마이그레이션 | 기존 강사 차단 방지 |

---

## 전체 API 엔드포인트 (51개)

| 카테고리 | 개수 |
|----------|------|
| 인증 | 2 (kakao, apply-instructor) |
| 프로그램 | 5 |
| 예약 | 4 |
| 결제 | 2 |
| 출석 | 4 |
| 알림 | 4 |
| 사진첩 | 4 |
| 정산 (강사) | 1 |
| 어드민 | 17 (기존 13 + 강사 관리 4) |
| 업체 프로필 | 5 |
| 스케줄링 (Cron) | 2 |
| **합계** | **50 + Cron 2** |

---

## Sprint 10 — 예약 정합성 & 원자적 좌석 제어 (완료)

### 개요
동시성 환경에서 예약 도메인 무결성을 강화. 구조적 리팩토링 없이 기존 BusinessException + ApiErrorFilter 계약 유지.

### 주요 변경

| 항목 | 내용 |
|------|------|
| `Program.reservedCount` | 비정규화 좌석 카운터 추가 (aggregate join 제거) |
| 마이그레이션 | `20260214000000_add_reserved_count` — backfill + CHECK(reserved_count >= 0) |
| 예약 생성 | `prisma.$transaction` + 원자적 SQL UPDATE (reserved_count + delta ≤ max_capacity) |
| 예약 취소 | `prisma.$transaction` + 원자적 decrement + BusinessException 가드 |
| 일괄 취소 | `admin-bulk-cancel` 에도 원자적 reserved_count 감소 적용 |
| 에러 표준화 | 모든 예외를 `BusinessException(code)` 으로 통일 |

### 에러 코드

| 코드 | HTTP | 설명 |
|------|------|------|
| `CAPACITY_EXCEEDED` | 400 | 잔여석 부족 |
| `RESERVATION_ALREADY_CANCELLED` | 400 | 이미 취소된 예약 |
| `RESERVATION_COMPLETED` | 400 | 완료된 예약 취소 불가 |
| `RESERVATION_NOT_FOUND` | 404 | 예약 미존재 |
| `RESERVATION_FORBIDDEN` | 403 | 본인 예약 아님 |
| `INVARIANT_VIOLATION` | 500 | reservedCount 불변 조건 위반 |
| `VALIDATION_ERROR` | 400 | participantCount ≤ 0 |

### 테스트

| 파일 | 테스트 수 | 검증 내용 |
|------|-----------|-----------|
| `reservation-concurrency.spec.ts` | 5 | 동시 생성 시 오버부킹 방지 (1인/2인/혼합), CAPACITY_EXCEEDED 상세, 유효성 검증 |
| `reservation-cancel.spec.ts` | 9 | 취소 시 좌석 복원, 이중 취소 방지, 완료 예약 거부, 불변 조건, 환불 호출 검증 |

### 검증 결과
- `prisma generate`: PASS
- `tsc --noEmit`: PASS
- `jest`: 10 suites, 107 tests — ALL PASS
- `nest build`: PASS

### 변경 파일 (11개)

**신규 (6개):**
- `apps/server/src/prisma/migrations/20260209000000_add_settlement_and_approval/migration.sql`
- `apps/server/src/prisma/migrations/20260214000000_add_reserved_count/migration.sql`
- `apps/server/test/reservation-cancel.spec.ts`
- `apps/server/test/reservation-concurrency.spec.ts`
- `specs/sprint-08-hardening/SPEC_SPRINT8_HARDENING.md`
- `specs/sprint-10-reservation-consistency/SPEC_SPRINT10_RESERVATION_CONSISTENCY.md`

**수정 (5개):**
- `apps/server/src/reservations/reservations.service.ts`
- `apps/server/src/admin/admin-bulk-cancel.service.ts`
- `apps/server/src/prisma/schema.prisma`
- `apps/server/test/admin-bulk-cancel.spec.ts`
- `status.md`

---

## Sprint 12 — ProgramSchedule 도입 (완료)

### 개요
예약을 Program이 아닌 ProgramSchedule(회차)에 귀속시켜 일정/정원의 SSOT를 분리.

### 주요 변경

| 항목 | 내용 |
|------|------|
| `ProgramSchedule` 모델 | id, programId, startAt, endAt, capacity, status (ACTIVE/CANCELLED) |
| 제약조건 | UNIQUE(programId, startAt), INDEX(startAt), INDEX(programId) |
| `Reservation.programScheduleId` | nullable FK 추가 (기존 데이터 호환) |
| 예약 생성 | programScheduleId 기반 + startAt fallback upsert |
| 스케줄 조회 | `GET /programs/:id/schedules` 신규 |
| 백필 스크립트 | `src/scripts/backfill-schedule.ts` — DRY_RUN, per-program tx, idempotent |

### 변경 파일 (10개)
- `schema.prisma`, `migrations/20260214200000_add_program_schedule/migration.sql`
- `reservations.service.ts`, `create-reservation.dto.ts`
- `programs.controller.ts`, `programs.service.ts`
- `test/program-schedule.spec.ts`, `test/reservation-schedule.spec.ts`, `test/reservation-concurrency.spec.ts`
- `specs/sprint-12-programschedule/SSOT.md`

---

## Sprint 13 — Atomic Schedule Capacity (완료)

### 개요
count-based 정원 체크를 `remaining_capacity` 원자적 증감으로 교체. PostgreSQL 행 수준 잠금으로 동시성 안전 보장.

### 주요 변경

| 항목 | 내용 |
|------|------|
| `program_schedules.remaining_capacity` | INT NOT NULL + CHECK(≥ 0) — 데이터 무결성 가드 |
| 마이그레이션 | `20260216000000_add_remaining_capacity` — 컬럼 추가 + backfill + NOT NULL + CHECK |
| 예약 생성 | `$executeRaw` 원자적 decrement (`WHERE remaining_capacity >= participantCount`) |
| 예약 취소 | 3-step idempotent: findUnique → updateMany(status guard) → conditional increment |
| `programs.reserved_count` | analytics only (enforcement 제거) |
| 정합성 스크립트 | `src/scripts/reconcile-capacity.ts` — mismatch 쿼리, 0 rows = OK |

### 동시성 보장

| 시나리오 | 보장 |
|----------|------|
| 동시 예약 | 행 수준 UPDATE 직렬화; WHERE 절이 concurrency guard |
| 동시 취소 | updateMany status guard — 첫 호출만 count=1, 나머지 skip |
| 롤백 | decrement + create 동일 $transaction — create 실패 시 전체 롤백 |

### 테스트

| 파일 | 검증 내용 |
|------|-----------|
| `reservation-concurrency.spec.ts` | barrier-based booking race (20 iter), tx-entry barrier cancel (20 iter), rollback proof, reconciliation |

### 변경 파일 (6개)
- `schema.prisma`, `migrations/20260216000000_add_remaining_capacity/migration.sql`
- `reservations.service.ts`
- `test/reservation-concurrency.spec.ts`
- `src/scripts/reconcile-capacity.ts`
- `specs/sprint-13-remaining-capacity/SSOT.md`

---

## Sprint 14 — Admin Readiness Hardening (완료)

### 개요
Phase 5 (어드민 대시보드 프론트엔드) 진입 전 어드민 API 계약 안정화 + 운영 도구 강화.

### Topic 1 — admin-api-contract-stabilization (PR #3)
- 6개 어드민 쿼리 DTO에 `@Max(100)` + `resolvedLimit` 추가
- `AdminQueryProvidersDto`: `search`/`query` alias + `resolvedSearch`
- `QueryBulkCancelItemsDto`: `limit`/`pageSize` alias + `resolvedLimit`
- `admin.service.ts`: `resolvedLimit`/`resolvedSearch` 사용으로 통일
- 비파괴 별칭(deprecated DTO fields + resolver getters)으로 하위 호환 유지

### Topic 2 — reconcile-capacity-script (PR #4)
- `reconcile-capacity.ts`에 수리 모드 추가 (`FIX=1 CONFIRM=FIX_CAPACITY`)
- 낙관적 업데이트: `WHERE remaining_capacity = $old` (동시 수정 감지)
- 단일 `$transaction`으로 전체 수리 (all-or-nothing)
- 구조화된 `[reconcile-capacity]` 요약 로깅
- 테스트: `reconcile-capacity.spec.ts` — 5개 PASS

### 변경 파일 (Topic 2, 3개)
- `src/scripts/reconcile-capacity.ts` — 수리 모드, 낙관적 업데이트, 구조화 로깅
- `test/reconcile-capacity.spec.ts` — 신규 5개 테스트
- `specs/sprint-14-admin-readiness-hardening/SPEC_SPRINT14_SSOT.md` — SSOT 신규

---

## Sprint 15 — Structured Error & Observability (완료)

### 개요
에러 응답 표준화 + 요청 수준 관찰성 도입. Phase 5 (어드민 대시보드 UI) 진입 전 API 계약 정비.

### Topic 1 — unified-error-envelope (PR #5)
- 모든 에러 응답을 `{ success: false, error: { code, message, requestId, ...details } }` 형태로 통일
- `BusinessException`, `ValidationPipe`, `HttpException`, 미처리 예외 모두 동일 envelope 적용
- `requestId` 누락 시 `null` (crash 방지)
- 테스트: `error-envelope.spec.ts` — 7개 PASS

### Topic 2 — request-id-propagation (PR #5)
- `RequestIdMiddleware`: `X-Request-Id` 헤더 수신 또는 `req_<crypto.randomUUID()>` 생성
- `RequestIdInterceptor`: 요청 시작/종료 로깅 (method, url, status, duration, requestId)
- Express `Request` 타입 확장 (`src/types/express.d.ts`)
- 테스트: `request-id.spec.ts` — 5개 PASS

### 변경 파일 (8개)
**신규 (5개):**
- `src/common/middleware/request-id.middleware.ts`
- `src/common/interceptors/request-id.interceptor.ts`
- `src/types/express.d.ts`
- `test/error-envelope.spec.ts`
- `test/request-id.spec.ts`

**수정 (3개):**
- `src/common/filters/api-error.filter.ts`
- `src/app.module.ts`
- `src/main.ts`

---

## Sprint 16 — Admin Dashboard UI Foundation (완료)

### 개요
어드민 대시보드 프론트엔드(Next.js 14 App Router) Phase 5 첫 스프린트. 강사 관리 + 일괄 취소 UI 구현.

### CP 진행

| CP | 내용 | 상태 |
|----|------|------|
| CP0 | `GET /admin/instructors/:id` 엔드포인트 | 완료 |
| CP1 | Admin API 클라이언트 Sprint 15 에러 envelope 정렬 | 완료 |
| CP2 | Sidebar 업데이트 (강사 관리 + 일괄 취소 메뉴) | 완료 |
| CP3 | `/instructors` 목록 페이지 | 완료 |
| CP4 | `/instructors/[id]` 상세 페이지 | 완료 |
| CP5 M2 | `/bulk-cancel` 최소 UI + dry-run 미리보기 | 완료 |
| CP5 M3 | 일괄 취소 실행 (확인 모달 + Job 요약) | 완료 |
| CP5 M4 | Job items 페이지네이션 + retry | **완료 (Sprint 17)** |

### 주요 설계 결정

| 결정 | 이유 |
|------|------|
| 백엔드 변경 없음 | 기존 어드민 API 엔드포인트만 사용 |
| `:sessionId` 경로 파라미터 그대로 사용 | 백엔드 레거시 네이밍 — 실제로는 programId 매핑 |
| 서버 dryRun 활용 | 백엔드에서 `dryRun: true` 네이티브 지원 확인 |
| 단일 페이지 워크플로우 | `/bulk-cancel` 내에서 선택→미리보기→실행→결과 단계 전환 |
| `ApiError.code` 기반 분기 | `error.message` 의존 금지 |
| `requestId` 항상 표시 | 에러 패널에 code + requestId 노출 |
| `limit` vs `pageSize` 구분 | `/admin/programs`는 `limit`, `/admin/bulk-cancel-jobs/:id/items`는 `pageSize` |

### API 엔드포인트 사용

| Method | Endpoint | 용도 |
|--------|----------|------|
| GET | `/admin/programs?page=&limit=&search=` | 프로그램 목록 (일괄 취소 대상 선택) |
| POST | `/admin/sessions/:sessionId/bulk-cancel` | 일괄 취소 작업 생성 (dryRun 포함) |
| POST | `/admin/bulk-cancel-jobs/:jobId/start` | 작업 실행 |
| GET | `/admin/bulk-cancel-jobs/:jobId` | 작업 요약 조회 |

### 변경 파일

**신규 (1개):**
- `apps/admin/src/app/bulk-cancel/page.tsx` — 일괄 취소 전체 워크플로우

**수정 (1개):**
- `.gitignore` — `.claude/` 추가

**스펙 (2개):**
- `specs/sprint-16-admin-dashboard-ui-foundation/SSOT.md` — 신규 (리네임)
- `specs/sprint-16-admin-dashboard-ui-foundation/SPEC_SPRINT16_SSOT.md` — 삭제 (통합)

---

## Sprint 17 — Admin Pagination + Metrics Foundation (완료)

### 개요
Sprint 16에서 이연된 CP5 M4 (일괄 취소 항목 페이지네이션) 완료 + 대시보드 통계 카드 에러 처리 강화.

### Milestone 진행

| Milestone | 내용 | 상태 |
|-----------|------|------|
| M1 | CP5 M4: Job items 페이지네이션 + retry + URL sync | 완료 |
| M2 | 대시보드 통계 카드 + 에러/retry 처리 | 완료 |

### M1 — CP5 M4: Job Items Pagination + Retry

- `GET /admin/bulk-cancel-jobs/:jobId/items` (page, pageSize, result 필터)
- URL searchParams 동기화 (jobId, itemsPage, pageSize, resultFilter)
- `router.replace` 사용 (히스토리 오염 방지)
- URL 복원: 새로고침 시 jobId로 작업 요약 자동 복원
- `POST /admin/bulk-cancel-jobs/:jobId/retry` + 요약/항목 새로고침
- 페이지 클램핑: `itemsPage`가 `totalPages` 초과 시 자동 보정
- Smoke Test: A/B/C/D PASS

### M2 — Dashboard Stats Cards

- `GET /admin/dashboard/stats` → 5개 메트릭 카드 (totalUsers, totalReservations, totalRevenue, pendingPrograms, pendingInstructors)
- 에러 패널: `error.code` + `requestId` 표시 + 재시도 버튼
- 대시보드 경로: `/` (`apps/admin/src/app/page.tsx`)

### API 엔드포인트 사용

| Method | Endpoint | 용도 |
|--------|----------|------|
| GET | `/admin/bulk-cancel-jobs/:jobId/items?page=&pageSize=&result=` | 작업 항목 조회 (페이지네이션) |
| POST | `/admin/bulk-cancel-jobs/:jobId/retry` | 실패 항목 재시도 |
| GET | `/admin/dashboard/stats` | 대시보드 통계 |

### 변경 파일

**수정 (2개):**
- `apps/admin/src/app/bulk-cancel/page.tsx` — 항목 테이블 + 페이지네이션 + URL sync + retry
- `apps/admin/src/app/page.tsx` — 에러 처리 + retry + 로딩 상태

**스펙 (3개):**
- `specs/sprint-17-admin-pagination-and-metrics/SSOT.md`
- `specs/sprint-17-admin-pagination-and-metrics/CP5_M4_CONTRACT.md`
- `specs/sprint-17-admin-pagination-and-metrics/DASHBOARD_STATS_CONTRACT.md`

---

## Sprint 20 — Vendor Mini Homepage MVP: M1 Public Profile Skeleton (완료)

### 개요
Public Instructor Profile 읽기 전용 스켈레톤 페이지 구현. slug 기반 라우팅, isPublic 가드(instructorStatus=APPROVED), 예약 시스템 무변경.

### 변경 파일

**신규 (Backend 3개):**
- `apps/server/src/public/public.module.ts` — PublicModule 등록
- `apps/server/src/public/public.controller.ts` — `GET /public/instructors/:slug` 엔드포인트
- `apps/server/src/public/public.service.ts` — 강사 조회 + isPublic(APPROVED) 가드 + 404

**수정 (Backend 1개):**
- `apps/server/src/app.module.ts` — PublicModule import 추가

**신규 (Frontend 8개):**
- `apps/web/package.json` — @sooptalk/web Next.js 앱 (port 3002)
- `apps/web/tsconfig.json` — TypeScript 설정
- `apps/web/next.config.js` — Next.js 설정 (transpilePackages)
- `apps/web/postcss.config.js` — Tailwind CSS PostCSS 설정
- `apps/web/src/app/globals.css` — Tailwind import
- `apps/web/src/app/layout.tsx` — Root layout
- `apps/web/src/app/page.tsx` — 홈페이지 placeholder
- `apps/web/src/app/instructors/[slug]/page.tsx` — 강사 공개 프로필 페이지
- `apps/web/src/lib/api.ts` — Public API fetch 유틸

### 검증 결과
- `apps/server pnpm build`: PASS
- `apps/server pnpm test`: 16 passed, 2 failed (pre-existing mock issues, Sprint 20 무관)
- `apps/web pnpm build`: PASS
- 예약 시스템 코드/테스트: **무변경**

---

## Sprint 20 — M2 Slug Strategy (완료)

### 개요
Human-readable slug 도입. UUID 기반 기존 링크와 backward compatibility 유지 (dual-read + 308 redirect).

### 주요 변경

| 항목 | 내용 |
|------|------|
| `User.slug` | `String? @unique` — nullable + unique constraint 추가 |
| Slug 형식 | `{romanized-name}-{shortId}` (shortId = UUID 앞 4자) |
| 한글 로마자 변환 | 자체 경량 jamo 분해 매핑 (외부 의존성 없음) |
| Dual-read | UUID → `findUnique({ id })`, slug → `findFirst({ slug })` |
| 308 Redirect | UUID로 접근 시 canonical slug URL로 308 Permanent Redirect |
| Slug 생성 | 회원 가입 시 자동 생성 (best-effort, try/catch) |
| Backfill 스크립트 | `src/scripts/backfill-slug.ts` — DRY_RUN 지원, idempotent |
| Fallback | 이름 없는 경우 `inst-{shortId}`, 충돌 시 `-2`, `-3` 접미사 |
| 예약 시스템 | **무변경** |

### 변경 파일

**신규 (5개):**
- `apps/server/src/prisma/migrations/20260217000000_add_slug_to_user/migration.sql` — slug 컬럼 + unique index
- `apps/server/src/public/slug.utils.ts` — `slugify()` + `generateUniqueSlug()`
- `apps/server/src/scripts/backfill-slug.ts` — 기존 APPROVED 강사 slug 백필
- `apps/server/test/slug-utils.spec.ts` — slug 유틸 테스트 (13개)
- `apps/server/test/public-instructor-profile.spec.ts` — 프로필 엔드포인트 테스트 (9개)

**수정 (3개):**
- `apps/server/src/prisma/schema.prisma` — User 모델에 `slug String? @unique` 추가
- `apps/server/src/public/public.service.ts` — dual-read + 308 redirect 시그널
- `apps/server/src/public/public.controller.ts` — 308 redirect 처리
- `apps/server/src/auth/auth.service.ts` — 회원 가입 시 slug 자동 생성

### 검증 결과
- `apps/server pnpm build`: PASS
- `apps/server pnpm test`: 18 passed, 2 failed (pre-existing reservation mock issues, Sprint 20 무관)
- `apps/web pnpm build`: PASS
- `apps/admin pnpm build`: PASS
- 예약 시스템 코드/테스트: **무변경** (git diff 확인)
- Local DB migration: PASS
- Backfill dry-run: verified

---

## Sprint 20 — M3 One-Time Slug Update (완료)

### 개요
승인된 강사가 자신의 slug를 1회 커스텀 변경할 수 있는 `PATCH /instructor/slug` 엔드포인트. Race-safe `updateMany` + slug 정규화.

### 주요 변경

| 항목 | 내용 |
|------|------|
| `User.slugChangeCount` | `Int @default(0)` — 변경 횟수 추적 |
| `PATCH /instructor/slug` | JwtAuthGuard, UpdateSlugDto (regex + min/max length) |
| Race safety | `updateMany` with `{ slugChangeCount: { lt: 1 }, instructorStatus: 'APPROVED' }` |
| Slug 정규화 | `toLowerCase()` → 반복 하이픈 병합 → 앞뒤 하이픈 제거 |
| 에러 코드 | 404 USER_NOT_FOUND, 403 INSTRUCTOR_NOT_APPROVED, 400 SLUG_CHANGE_EXHAUSTED/SLUG_UNCHANGED, 409 SLUG_TAKEN |
| 예약 시스템 | **무변경** (테스트 mock만 수정) |

### 변경 파일

**신규 (6개):**
- `apps/server/src/instructor/instructor.module.ts`
- `apps/server/src/instructor/instructor.controller.ts`
- `apps/server/src/instructor/instructor.service.ts`
- `apps/server/src/instructor/dto/update-slug.dto.ts`
- `apps/server/src/prisma/migrations/20260218000000_add_slug_change_count/migration.sql`
- `apps/server/test/instructor-slug-update.spec.ts` — 10개 테스트

**수정 (4개):**
- `apps/server/src/prisma/schema.prisma` — slugChangeCount 추가
- `apps/server/src/app.module.ts` — InstructorModule import
- `apps/server/test/reservation-cancel.spec.ts` — tx mock 수정 (findUnique/updateMany)
- `apps/server/test/reservation-schedule.spec.ts` — $executeRaw mock 수정 (schedule vs program 구분)

### 검증 결과
- `prisma generate`: PASS
- `tsc --noEmit`: PASS
- `jest`: 21 suites, 181 tests — ALL PASS

---

## Sprint 20 — M4 Slug History Redirects (완료)

### 개요
강사가 slug를 변경한 후 이전 URL(`/public/instructors/{old-slug}`)이 404가 되는 문제 해결. 이전 slug를 `slug_histories` 테이블에 기록하고, 현재 slug로 308 Permanent Redirect 반환.

### 주요 변경

| 항목 | 내용 |
|------|------|
| `SlugHistory` 모델 | `id`, `userId`, `slug` (@unique), `createdAt` — `slug_histories` 테이블 |
| `InstructorService.updateSlug` | `prisma.$transaction`으로 래핑 — slug 변경 시 이전 slug를 `slugHistory.create`로 원자적 기록 |
| `PublicService.getInstructorProfile` | slug 조회 실패 시 `slugHistory` fallback — APPROVED 상태인 경우만 `{ redirect: newSlug }` 반환 |
| UUID 조회 | slug history 미참조 (기존 동작 유지) |
| 체인 해결 | 별도 처리 불필요 — history → user.slug (현재값) 자동 해결 |
| 예약 시스템 | **무변경** |

### 에러 처리

| 시나리오 | 결과 |
|----------|------|
| 현재 slug 조회 | 기존 동작 (프로필 반환) |
| 이전 slug 조회 + APPROVED | 308 redirect → 현재 slug |
| 이전 slug 조회 + NOT APPROVED | 404 |
| 알 수 없는 slug | 404 |

### 변경 파일

**신규 (2개):**
- `apps/server/src/prisma/migrations/20260219000000_add_slug_history/migration.sql`
- `apps/server/test/slug-history-redirect.spec.ts` — 8개 테스트 (PublicService 6 + InstructorService 2)

**수정 (5개):**
- `apps/server/src/prisma/schema.prisma` — SlugHistory 모델 + User 관계 추가
- `apps/server/src/instructor/instructor.service.ts` — $transaction + slugHistory.create
- `apps/server/src/public/public.service.ts` — slugHistory fallback 추가
- `apps/server/test/instructor-slug-update.spec.ts` — transaction mock 패턴 적용
- `apps/server/test/public-instructor-profile.spec.ts` — slugHistory mock 추가

### 검증 결과
- `prisma db push`: PASS
- `jest`: 22 suites, 189 tests — ALL PASS

---

## 다음 단계

- Redis 분산 락 제거 검토 (remaining_capacity로 대체 가능)
- DB 마이그레이션 적용: `npx prisma migrate deploy` 필요

---

## Sprint 21 — M1 SEO Meta Foundation (완료)

### 개요
Public Instructor Profile(`/instructors/[slug]`) 페이지에 동적 SEO 메타(title, description, OpenGraph, canonical URL) 구현.
Backend/DB/예약 시스템은 변경하지 않으며, 기존 redirect 및 APPROVED 로직을 그대로 유지한다.

### 주요 변경

| 항목 | 내용 |
|------|------|
| `generateMetadata()` | Next.js App Router 메타데이터 함수 — SSR 시점에 동적 메타 생성 |
| Title | `{displayName} \| 숲똑` (fallback: `강사 소개 \| 숲똑`) |
| Description | `bio` 필드 (없으면 `숲체험 강사 소개 페이지입니다.`), 160자 truncate |
| OpenGraph | `og:title`, `og:description`, `og:url`, `og:type=profile`, `og:image` (프로필 이미지 있을 때) |
| Canonical | `NEXT_PUBLIC_SITE_URL` + `/instructors/{slug}` (env 없으면 path-only) |
| 데이터 재사용 | React `cache()` 래핑 — `generateMetadata`와 page 컴포넌트가 동일 fetch 공유 |
| Redirect 보존 | metadata에서는 fallback 반환만, `notFound()`는 기존 page 로직에서만 호출 |

### 변경 파일

**수정 (1개):**
- `apps/web/src/app/instructors/[slug]/page.tsx` — `generateMetadata` 추가, `getInstructorProfile`을 `cache()` 래핑

### 검증 결과

| 케이스 | 결과 |
|--------|------|
| APPROVED instructor slug | title/desc/OG/canonical SSR 렌더링 |
| 미존재 slug | fallback title + `notFound()` (기존 동일) |
| 비승인 slug | backend 404 → fallback title + `notFound()` (기존 동일) |

- `next build`: PASS (Dynamic route 정상 컴파일)
- Backend/DB/예약 모듈: **무변경**
- APPROVED 로직: **변경 없음**

---

## Sprint 23 — Public Instructor List API (완료)

### 개요
apps/web 사이트맵 어댑터 연결(Sprint 24)을 위한 공개 강사 열거 엔드포인트. apps/server only.

### 주요 변경

| 항목 | 내용 |
|------|------|
| `GET /public/instructors` | 커서 기반 페이지네이션 (updatedAt DESC, id DESC) |
| 필터링 | `instructorStatus: 'APPROVED'` + `slug: { not: null }` (hardcoded) |
| 응답 형태 | `{ success, data: { items: [{slug, updatedAt}], nextCursor, hasMore } }` |
| 커서 인코딩 | `base64url(updatedAt\|id)` — 무효 커서 시 첫 페이지 반환 (dev-only 경고) |
| 기존 엔드포인트 | `GET /public/instructors/:slug` **무변경** (308 redirect + 404 보존) |

### 변경 파일 (apps/server only, 4개)

**신규 (2개):**
- `apps/server/src/public/dto/query-public-instructors.dto.ts`
- `apps/server/test/public-instructor-list.spec.ts` — 10개 테스트

**수정 (2개):**
- `apps/server/src/public/public.controller.ts` — `@Get('instructors')` 추가 (`:slug` 앞 선언)
- `apps/server/src/public/public.service.ts` — `listApprovedInstructors()` + 커서 encode/decode

### 검증 결과
- `tsc --noEmit`: PASS
- `jest`: 23 suites, 199 tests — ALL PASS
- 기존 `GET /public/instructors/:slug` 테스트: **무변경, 통과**
- apps/web: **무변경**
# #   R e p o   G u a r d r a i l s   ( v e r i f i e d   2 0 2 6 - 0 2 - 1 6 ) 
 -   B r a n c h   p r o t e c t i o n :   m a i n 
 -   R e q u i r e   s t a t u s   c h e c k s :   W e b   E 2 E   T e s t s   ( . g i t h u b / w o r k f l o w s / w e b - e 2 e . y m l ) 
 -   R e q u i r e   c o n v e r s a t i o n   r e s o l u t i o n :   O N 
 -   R e q u i r e   b r a n c h e s   t o   b e   u p   t o   d a t e   b e f o r e   m e r g i n g :   O N 
 -   B l o c k   f o r c e   p u s h e s :   O N 
 -   R e s t r i c t   d e l e t i o n s :   O N 
 
 
 