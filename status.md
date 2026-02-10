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
- `admin.service.ts` — getDashboardStats, findPrograms, approveProgram(+FCM), rejectProgram(+FCM), findUsers, changeUserRole, chargeCash
- `admin.controller.ts` — 13개 어드민 엔드포인트 (모두 JWT + ADMIN)
- `dto/` — admin-query-programs, reject-program, change-role, admin-query-users, charge-cash
- `admin.module.ts` — imports NotificationsModule, SettlementsModule

### Step 5: ProgramsModule 수정
- `findAll()` — `approvalStatus: 'APPROVED'` 필터 추가 (승인된 프로그램만 공개)
- `findMyPrograms(instructorId)` — 신규 메서드 (모든 승인 상태)
- `GET /programs/my` — 신규 엔드포인트 (`GET /programs/:id` 앞에 배치)
- `create-program.dto.ts` — `isB2b` 필드 추가

### Step 6: CronModule 확장
- `cron.module.ts` — SettlementsModule import 추가
- `@Cron('0 2 * * 4')` — 매주 목요일 02:00 자동 정산
- Redis 분산 락으로 중복 실행 방지
- 전주 월~일 기간 계산 → `settlementsService.generateSettlements()` 호출

### Step 7: 통합
- `app.module.ts` — `SettlementsModule`, `AdminModule` import 추가
- `pnpm run build` — 전체 빌드 성공 (shared, server, admin, mobile)

## Phase 4 이후 변경 사항 (4가지 수정)

### 변경 1: 인증 100% 카카오 로그인
- `POST /auth/register`, `POST /auth/login` 삭제
- `register.dto.ts`, `login.dto.ts` 삭제
- `auth.service.ts`: `register()`, `login()`, `bcrypt` 제거
- `kakao-login.dto.ts`: `role?: UserRole` 선택 필드 추가 (첫 가입 시 역할 지정)
- `User` 모델: `password` 필드 제거
- 인증 엔드포인트: `POST /auth/kakao` 1개만 유지

### 변경 2: 위치+시간 자동 출석 체크
- `auto-checkin.dto.ts` 신규: `reservationId`, `latitude`, `longitude`
- `Attendance` 모델: `checkinLatitude Float?`, `checkinLongitude Float?` 추가
- `attendance.service.ts`: `autoCheckin()` 추가 — Haversine 거리(≤100m) + 시간 범위(±30분) 검증
- `POST /attendance/auto-checkin` (JWT) 엔드포인트 추가
- 상수: `AUTO_CHECKIN_RADIUS_METERS = 100`, `AUTO_CHECKIN_TIME_WINDOW_MINUTES = 30`

### 변경 3: 정산일 목요일로 변경
- `SETTLEMENT_CRON_EXPRESSION = '0 2 * * 4'` (수요일→목요일)
- `cron.service.ts`: `@Cron('0 2 * * 4')`

### 변경 4: 알림 비용 선충전 캐시
- `User` 모델: `messageCashBalance Int @default(0)` 추가
- `notifications.service.ts`: 유료 알림(PRE_ACTIVITY, GALLERY_UPLOADED) 발송 전 강사 캐시 잔액 확인 → 부족 시 차단 + 충전 안내 FCM
- `admin.service.ts`: `chargeCash(userId, amount)` 추가
- `POST /admin/users/:id/charge-cash` 엔드포인트 추가
- `settlements.service.ts`: `notificationCost = 0` (선충전이므로 정산에서 이중 차감 방지)

## 정산 계산 공식

```
grossAmount      = SUM(PAID payments in period for instructor)
refundAmount     = SUM(refundedAmount in period for instructor)
notificationCost = 0 (선충전 캐시 방식으로 발송 시 차감, 정산 시 이중 차감 방지)
b2bCommission    = SUM(B2B PAID payments) × 0.05
platformFee      = (grossAmount - refundAmount) × 0.10
netAmount        = grossAmount - refundAmount - platformFee - notificationCost - b2bCommission
```

## 전체 API 엔드포인트

| Method | Endpoint | Auth | Role | 설명 |
|--------|----------|------|------|------|
| POST | /auth/kakao | - | - | 카카오 로그인 (유일한 인증) |
| GET | /programs | - | - | 프로그램 검색/조회 (승인된 것만) |
| GET | /programs/my | JWT | INSTRUCTOR | 강사 본인 프로그램 조회 |
| GET | /programs/:id | - | - | 프로그램 상세 |
| POST | /programs | JWT | INSTRUCTOR | 프로그램 생성 |
| PATCH | /programs/:id | JWT | INSTRUCTOR | 프로그램 수정 |
| POST | /reservations | JWT | PARENT | 예약 생성 |
| GET | /reservations | JWT | - | 내 예약 목록 |
| GET | /reservations/:id | JWT | - | 예약 상세 |
| PATCH | /reservations/:id/cancel | JWT | - | 예약 취소 |
| POST | /payments/prepare | JWT | - | 결제 세션 생성 |
| POST | /payments/webhook | - | - | PortOne 웹훅 |
| POST | /attendance/check | JWT | INSTRUCTOR | 수동 출석 체크 |
| POST | /attendance/auto-checkin | JWT | - | 위치+시간 자동 출석 체크 |
| GET | /attendance/qr/:reservationId | JWT | - | QR 코드 조회 |
| POST | /attendance/qr/verify | JWT | INSTRUCTOR | QR 스캔 출석 확인 |
| GET | /notifications | JWT | - | 내 알림 목록 |
| GET | /notifications/unread-count | JWT | - | 읽지 않은 알림 수 |
| PATCH | /notifications/:id/read | JWT | - | 알림 읽음 처리 |
| PATCH | /notifications/read-all | JWT | - | 모든 알림 읽음 처리 |
| POST | /gallery/upload-url | JWT | INSTRUCTOR | Pre-signed 업로드 URL |
| POST | /gallery/confirm | JWT | INSTRUCTOR | 업로드 확인 + 썸네일 |
| GET | /gallery/program/:programId | JWT | - | 사진첩 조회 |
| DELETE | /gallery/:id | JWT | INSTRUCTOR | 사진 삭제 |
| GET | /settlements/my | JWT | INSTRUCTOR | 강사 본인 정산 조회 |
| GET | /admin/dashboard/stats | JWT | ADMIN | 대시보드 통계 |
| GET | /admin/programs | JWT | ADMIN | 프로그램 목록 |
| PATCH | /admin/programs/:id/approve | JWT | ADMIN | 프로그램 승인 |
| PATCH | /admin/programs/:id/reject | JWT | ADMIN | 프로그램 거절 |
| GET | /admin/settlements | JWT | ADMIN | 정산 목록 |
| GET | /admin/settlements/:id | JWT | ADMIN | 정산 상세 |
| POST | /admin/settlements/generate | JWT | ADMIN | 수동 정산 생성 |
| PATCH | /admin/settlements/:id/confirm | JWT | ADMIN | 정산 확인 |
| PATCH | /admin/settlements/:id/pay | JWT | ADMIN | 정산 지급 완료 |
| PATCH | /admin/settlements/:id | JWT | ADMIN | 정산 메모 수정 |
| GET | /admin/users | JWT | ADMIN | 사용자 목록 |
| PATCH | /admin/users/:id/role | JWT | ADMIN | 사용자 역할 변경 |
| POST | /admin/users/:id/charge-cash | JWT | ADMIN | 알림 캐시 충전 |

## 빌드 상태
- `pnpm run build` — 전체 빌드 성공 (shared, server, admin, mobile)
