# Phase 4: 정산 시스템 + 어드민 API (백엔드) — 완료

## 작업 요약

### Step 1: Shared 패키지 업데이트
- `packages/shared/src/types/settlement.ts` 신규 — `SettlementStatus` enum (PENDING, CONFIRMED, PAID), `Settlement` interface
- `packages/shared/src/types/program.ts` 수정 — `ApprovalStatus` enum (PENDING_REVIEW, APPROVED, REJECTED), `approvalStatus`/`rejectionReason`/`isB2b` 필드 추가
- `packages/shared/src/types/notification.ts` 수정 — `PROGRAM_APPROVED`, `PROGRAM_REJECTED`, `SETTLEMENT_CREATED` 추가
- `packages/shared/src/constants/index.ts` 수정 — `PLATFORM_FEE_RATE`, `NOTIFICATION_COST_PER_MESSAGE`, `DEFAULT_B2B_COMMISSION_RATE`, `SETTLEMENT_CRON_EXPRESSION`, `SETTLEMENT_LOCK_KEY_PREFIX`, `SETTLEMENT_LOCK_TTL_MS` 추가
- `packages/shared/src/index.ts` 수정 — 새 타입/상수 re-export

### Step 2: Prisma 스키마 변경
- `ApprovalStatus`, `SettlementStatus` enum 추가
- `NotificationType`에 3개 값 추가
- `Program` 모델: `approvalStatus`(default PENDING_REVIEW), `rejectionReason`, `isB2b`(default false), `@@index([approvalStatus])`
- `Settlement` 모델 신규: `@@unique([instructorId, periodStart, periodEnd])`
- `User` 모델: `settlements[]` 관계 추가
- 마이그레이션: 기존 프로그램 `APPROVED`로 일괄 업데이트

### Step 3: SettlementsModule
- `settlements.service.ts` — 정산 계산/생성/조회/상태변경 (generateSettlements, findAll, findOne, confirm, markAsPaid, update, findByInstructor)
- `settlements.controller.ts` — `GET /settlements/my` (INSTRUCTOR)
- `dto/` — query-settlement, generate-settlement, update-settlement
- `settlements.module.ts` — imports NotificationsModule, exports SettlementsService

### Step 4: AdminModule
- `admin.service.ts` — getDashboardStats, findPrograms, approveProgram(+FCM), rejectProgram(+FCM), findUsers, changeUserRole
- `admin.controller.ts` — 12개 어드민 엔드포인트 (모두 JWT + ADMIN)
- `dto/` — admin-query-programs, reject-program, change-role, admin-query-users
- `admin.module.ts` — imports NotificationsModule, SettlementsModule

### Step 5: ProgramsModule 수정
- `findAll()` — `approvalStatus: 'APPROVED'` 필터 추가 (승인된 프로그램만 공개)
- `findMyPrograms(instructorId)` — 신규 메서드 (모든 승인 상태)
- `GET /programs/my` — 신규 엔드포인트 (`GET /programs/:id` 앞에 배치)
- `create-program.dto.ts` — `isB2b` 필드 추가

### Step 6: CronModule 확장
- `cron.module.ts` — SettlementsModule import 추가
- `@Cron('0 2 * * 3')` — 매주 수요일 02:00 자동 정산
- Redis 분산 락으로 중복 실행 방지
- 전주 월~일 기간 계산 → `settlementsService.generateSettlements()` 호출

### Step 7: 통합
- `app.module.ts` — `SettlementsModule`, `AdminModule` import 추가
- `pnpm run build` — 전체 빌드 성공 (shared, server, admin, mobile)

## 정산 계산 공식

```
grossAmount      = SUM(PAID payments in period for instructor)
refundAmount     = SUM(refundedAmount in period for instructor)
notificationCost = COUNT(notifications in period) × 15
b2bCommission    = SUM(B2B PAID payments) × 0.05
platformFee      = (grossAmount - refundAmount) × 0.10
netAmount        = grossAmount - refundAmount - platformFee - notificationCost - b2bCommission
```

## 신규 API 엔드포인트 (15개)

| Method | Endpoint | Auth | Role | 설명 |
|--------|----------|------|------|------|
| GET | /programs/my | JWT | INSTRUCTOR | 강사 본인 프로그램 조회 (모든 상태) |
| GET | /settlements/my | JWT | INSTRUCTOR | 강사 본인 정산 조회 |
| GET | /admin/dashboard/stats | JWT | ADMIN | 대시보드 통계 |
| GET | /admin/programs | JWT | ADMIN | 프로그램 목록 (approvalStatus 필터) |
| PATCH | /admin/programs/:id/approve | JWT | ADMIN | 프로그램 승인 + FCM |
| PATCH | /admin/programs/:id/reject | JWT | ADMIN | 프로그램 거절 + FCM |
| GET | /admin/settlements | JWT | ADMIN | 정산 목록 |
| GET | /admin/settlements/:id | JWT | ADMIN | 정산 상세 |
| POST | /admin/settlements/generate | JWT | ADMIN | 수동 정산 생성 |
| PATCH | /admin/settlements/:id/confirm | JWT | ADMIN | 정산 확인 |
| PATCH | /admin/settlements/:id/pay | JWT | ADMIN | 정산 지급 완료 |
| PATCH | /admin/settlements/:id | JWT | ADMIN | 정산 메모 수정 |
| GET | /admin/users | JWT | ADMIN | 사용자 목록 |
| PATCH | /admin/users/:id/role | JWT | ADMIN | 사용자 역할 변경 |

## 신규/수정 파일 목록

### 신규 (14개)

| 파일 | 작업 |
|------|------|
| `packages/shared/src/types/settlement.ts` | Settlement 타입 |
| `apps/server/src/settlements/settlements.module.ts` | 모듈 |
| `apps/server/src/settlements/settlements.service.ts` | 정산 로직 |
| `apps/server/src/settlements/settlements.controller.ts` | 강사 엔드포인트 |
| `apps/server/src/settlements/dto/query-settlement.dto.ts` | DTO |
| `apps/server/src/settlements/dto/generate-settlement.dto.ts` | DTO |
| `apps/server/src/settlements/dto/update-settlement.dto.ts` | DTO |
| `apps/server/src/admin/admin.module.ts` | 모듈 |
| `apps/server/src/admin/admin.service.ts` | 어드민 로직 |
| `apps/server/src/admin/admin.controller.ts` | 어드민 엔드포인트 |
| `apps/server/src/admin/dto/admin-query-programs.dto.ts` | DTO |
| `apps/server/src/admin/dto/reject-program.dto.ts` | DTO |
| `apps/server/src/admin/dto/change-role.dto.ts` | DTO |
| `apps/server/src/admin/dto/admin-query-users.dto.ts` | DTO |

### 수정 (11개)

| 파일 | 변경 |
|------|------|
| `packages/shared/src/types/program.ts` | ApprovalStatus enum, 필드 추가 |
| `packages/shared/src/types/notification.ts` | NotificationType 3개 추가 |
| `packages/shared/src/constants/index.ts` | 정산 관련 상수 6개 추가 |
| `packages/shared/src/index.ts` | re-export 추가 |
| `apps/server/src/prisma/schema.prisma` | 2 enum, Settlement 모델, Program 필드 |
| `apps/server/src/programs/programs.service.ts` | APPROVED 필터, findMyPrograms() |
| `apps/server/src/programs/programs.controller.ts` | GET /programs/my |
| `apps/server/src/programs/dto/create-program.dto.ts` | isB2b 필드 |
| `apps/server/src/cron/cron.service.ts` | 주간 정산 크론잡 |
| `apps/server/src/cron/cron.module.ts` | SettlementsModule import |
| `apps/server/src/app.module.ts` | SettlementsModule, AdminModule import |

## 빌드 상태
- `pnpm run build` — 전체 빌드 성공 (shared, server, admin, mobile)
