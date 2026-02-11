# SPEC Sprint 7 — Rainy-day Bulk Cancel (MVP, Dual-Mode Refund)
SSOT (Single Source of Truth). 구현·리뷰·테스트는 본 문서를 기준으로 한다.

---

## 0. Context
- Monorepo: Turborepo + pnpm
- Backend: NestJS (`apps/server`)
- Admin FE: Next.js (`apps/admin`)
- Payment: PortOne 연동(prepare/webhook) 존재. **PG 환불 호출 구현 유무**가 코드베이스마다 다를 수 있음.
- Existing: 단건 예약 취소 엔드포인트(`/reservations/:id/cancel`)가 존재할 가능성이 높음(우선 재사용).

---

## 1. Decisions / Defaults (모호하면 이 섹션을 따른다)

### 1.1 Actor / Permission
- 실행 주체: Admin만
- Parent/Instructor/Provider는 Sprint 7에서 **일괄 취소 실행 불가**

### 1.2 Target Unit
- 취소 단위: **ProgramSession(회차/날짜/시간)** 1건
- 해당 세션에 속한 **모든 Reservation**이 처리 대상

### 1.3 Refund Mode (Dual Mode)
Sprint 7은 아래 **두 모드** 중 하나로 실행된다. 구현은 “둘 다 지원”하되, 런타임에서 기능 가능 여부로 분기한다.

- **Mode A (PG Refund Enabled)**: 실제 PG(PortOne) 환불 요청까지 수행
- **Mode B (Ledger-only)**: PG 환불 호출 없이, 예약/결제 상태 및 정산 반영(환불 예정/환불 요청 상태)만 처리

**Mode 선택 규칙 (Fixed):**
- 서버 코드에서 `payments.service` 또는 `refund` 관련 서비스에 “실제 환불 호출 메서드”가 존재하고, 환경변수/설정이 활성화되어 있으면 Mode A로 동작한다.
- 그렇지 않으면 Mode B로 동작한다.
- Admin UI에는 현재 모드(A/B)를 표시한다(실행 전 확인용).

### 1.4 Idempotency (멱등성)
- 같은 sessionId에 대해 같은 요청을 반복 실행해도:
  - 중복 취소 ❌
  - 중복 환불 요청 ❌
  - 중복 알림 ❌
- 멱등성 키: `bulkCancelJobId` (서버가 생성) + `sessionId`

### 1.5 Partial Failure Strategy
- “전부 성공 아니면 전부 실패” 트랜잭션은 PG/알림 외부 연동 때문에 현실적으로 불가.
- 전략: **예약 단위로 처리 결과를 기록**하고, 실패 건은 재시도 가능하게 남긴다.
- 재시도는 같은 jobId로 “실패 건만 다시 처리”를 지원한다.

### 1.6 Notifications
- Parent에게 취소 알림 발송(푸시/이메일/SMS 중 기존 인프라 있는 것 사용)
- 알림이 실패해도 예약/환불 처리는 롤백하지 않음(결과에 실패로 기록)

---

## 2. Goals
- Admin이 특정 회차(Session)를 한 번에 취소 처리
- (가능하면) 환불까지 자동 처리 (Mode A)
- 환불 호출이 없더라도, 정산/회계상 환불액 추적 가능 (Mode B)
- 결과 리포트(성공/실패/스킵) 제공 + 재시도 가능

---

## 3. Scope
### 3.1 Backend
- BulkCancelJob(작업) 모델 추가 + 상태/결과 저장
- Admin: 세션 기반 일괄 취소 실행 API
- Admin: 작업 상태/결과 조회 API
- Admin: 실패 건 재시도 API
- 예약/결제/환불 상태 전이 구현(Mode A/B 분기)
- 알림 발송(가능한 채널 사용)

### 3.2 Admin FE
- “우천 일괄 취소” 페이지
- Session 선택(프로그램/날짜/회차) + 대상 예약 수/예상 환불액(가능하면) 표시
- 실행 버튼(확인 모달 필수)
- 실행 결과 리포트(성공/실패/스킵) 테이블 + 재시도 버튼

---

## 4. Non-Goals
- Instructor/Provider 셀프 일괄 취소
- 자동 기상 연동
- 부분 취소(일부 예약만 취소)
- 복잡한 환불 정책(수수료/부분환불/쿠폰 등) — Sprint 7에서는 기존 단건 취소 정책 그대로 재사용

---

## 5. Domain Model (Canonical)

### 5.1 BulkCancelJob
- id (uuid, PK)
- sessionId (uuid/string, 대상 ProgramSession)
- reason (string, ≤200)  // "우천", "폭염" 등
- mode (A_PG_REFUND | B_LEDGER_ONLY)
- status (PENDING | RUNNING | COMPLETED | COMPLETED_WITH_ERRORS | FAILED)
- totalTargets (int)
- successCount (int)
- failedCount (int)
- skippedCount (int)
- createdByAdminUserId (uuid)
- createdAt, updatedAt
- startedAt (nullable), finishedAt (nullable)

### 5.2 BulkCancelJobItem
- id (uuid, PK)
- jobId (FK)
- reservationId (uuid)
- result (SUCCESS | FAILED | SKIPPED)
- failureCode (string, nullable)
- failureMessage (string, nullable)
- attemptedAt (ISO)
- refundedAmount (int/decimal, nullable)  // Mode B에서도 추적 가능하면 기록
- notificationSent (boolean, default false)

**Constraints (Fixed):**
- UNIQUE(jobId, reservationId)
- UNIQUE(sessionId, reservationId) 를 원하면 추가(선택). 최소는 jobId+reservationId로 충분.

---

## 6. State Transitions (개념 규칙)

### 6.1 Reservation
- 대상 예약은 최종적으로 `CANCELLED`로 전이(기존 상태/필드명에 맞춤)
- 이미 CANCELLED/REFUNDED 등 “종료 상태”면 SKIPPED 처리

### 6.2 Payment / Refund
#### Mode A (PG Refund Enabled)
- PG 환불 요청 성공 시:
  - 결제 상태: REFUNDED (또는 기존 환불완료 상태)
  - refundedAmount 기록(가능하면)
- PG 환불 요청 실패 시:
  - 예약은 CANCELLED로 처리하되,
  - 환불 상태는 REFUND_FAILED(또는 환불요청실패에 해당하는 기존 상태)로 남기고 FAILED 기록

#### Mode B (Ledger-only)
- PG 호출 없음
- 결제 상태를 “환불 필요”로 전이:
  - 예: REFUND_REQUESTED / REFUND_PENDING / CANCELLED_PENDING_REFUND 중 기존 시스템에 맞는 값 선택
- refundedAmount(예상/전액) 산정 로직이 이미 있으면 기록, 없으면 null 허용

---

## 7. API Contract (SSOT)

### 7.1 Admin — Create Bulk Cancel Job
#### POST /admin/sessions/:sessionId/bulk-cancel
Auth: ADMIN

Req:
```json
{
  "reason": "우천",
  "dryRun": false
}
```

Rules:
- sessionId는 존재해야 함
- 동일 sessionId로 “진행 중(RUNNING)” 작업이 있으면 409
- dryRun=true이면 실제 변경 없이 대상/예상값만 계산해 반환(가능하면)

Res: 201
```json
{
  "jobId": "uuid",
  "sessionId": "uuid",
  "mode": "A_PG_REFUND",
  "status": "PENDING",
  "totalTargets": 18
}
```

Errors:
- 400 validation error
- 401/403 auth
- 404 session not found
- 409 job already running

### 7.2 Admin — Run (or Start) Job
#### POST /admin/bulk-cancel-jobs/:jobId/start
Auth: ADMIN

Res: 200
```json
{
  "jobId": "uuid",
  "status": "RUNNING",
  "startedAt": "ISO"
}
```

Rules:
- 이미 COMPLETED 계열이면 409
- 이미 RUNNING이면 200(멱등)

### 7.3 Admin — Get Job Summary
#### GET /admin/bulk-cancel-jobs/:jobId
Auth: ADMIN

Res: 200
```json
{
  "jobId": "uuid",
  "sessionId": "uuid",
  "mode": "B_LEDGER_ONLY",
  "status": "COMPLETED_WITH_ERRORS",
  "totalTargets": 18,
  "successCount": 16,
  "failedCount": 2,
  "skippedCount": 0,
  "createdAt": "ISO",
  "startedAt": "ISO",
  "finishedAt": "ISO"
}
```

### 7.4 Admin — List Job Items (paged)
#### GET /admin/bulk-cancel-jobs/:jobId/items?page=&pageSize=&result=
Auth: ADMIN

Res: 200
```json
{
  "items": [
    {
      "reservationId": "uuid",
      "result": "FAILED",
      "failureCode": "PG_REFUND_FAILED",
      "failureMessage": "string",
      "refundedAmount": 120000,
      "notificationSent": false,
      "attemptedAt": "ISO"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 18
}
```

### 7.5 Admin — Retry Failed Items
#### POST /admin/bulk-cancel-jobs/:jobId/retry
Auth: ADMIN

Req:
```json
{ "onlyFailed": true }
```

Res: 200
```json
{
  "jobId": "uuid",
  "status": "RUNNING"
}
```

Rules:
- onlyFailed=true이면 FAILED만 재시도
- 재시도도 동일 jobId로 수행(멱등/감사 용이)

---

## 8. Admin FE Spec (apps/admin)

### 8.1 Routes
- `/bulk-cancel` (메뉴명: “우천 일괄 취소”)

### 8.2 UX Requirements
- 세션 선택(기존 세션/프로그램 리스트 API 활용)
- 실행 전 확인 모달:
  - session 요약
  - 대상 예약 수
  - 현재 Refund Mode(A/B)
  - reason 입력
- 실행 후:
  - job summary 카드
  - items 테이블(상태/실패사유/알림여부)
  - “실패건 재시도” 버튼

---

## 9. Acceptance Criteria
- AC1: ADMIN만 실행 가능(401/403)
- AC2: 동일 세션에 RUNNING job 있으면 409
- AC3: 이미 CANCELLED 상태 예약은 SKIPPED로 기록되고 중복 처리 없음
- AC4: 같은 job start를 여러 번 호출해도 멱등(중복 실행 없음)
- AC5: Mode A에서 PG 환불 실패 시 해당 예약은 FAILED로 기록되고 전체 job은 COMPLETED_WITH_ERRORS
- AC6: Mode B에서 PG 호출 없이 결제/환불 관련 상태가 “환불 필요”로 전이됨
- AC7: Public/Parent 측에서는 취소된 예약이 정상적으로 취소 상태로 보임
- AC8: Items 조회에서 SUCCESS/FAILED/SKIPPED 및 failureMessage가 확인 가능
- AC9: retry는 FAILED 항목만 다시 시도하며 성공 시 SUCCESS로 업데이트

---

## 10. Testing (Minimum)
Backend tests (e2e 또는 service-level):
- Idempotency: start/retry 반복 호출 시 중복 처리 없음
- State gating: 이미 CANCELLED 예약은 SKIPPED
- Mode B: PG refund 호출 함수가 없을 때도 정상 처리
- Mode A: PG refund mock 실패 시 FAILED 기록 + job COMPLETED_WITH_ERRORS
- Pagination: items paging 정상

---

## 11. Implementation Notes (권장 구현 패턴)
- 가능하면 기존 `/reservations/:id/cancel` 로직을 **서비스 레벨로 분리**해 재사용
- BulkCancelJob은 “작업 큐”처럼 동작하지만, Sprint 7에서는 단일 프로세스/동기 실행도 허용(대상 수가 크면 추후 큐로 확장)
- 외부 연동(PG/알림)은 try/catch로 개별 실패를 기록하고 전체 중단을 피한다
- refundedAmount 산정 로직이 이미 존재하면 재사용, 없으면 null 허용(Mode B)

---

## 12. Deliverables Checklist
- [ ] DB: BulkCancelJob, BulkCancelJobItem migration
- [ ] Backend: Admin bulk cancel APIs (create/start/status/items/retry)
- [ ] Backend: Mode A/B 분기 로직
- [ ] Backend: 최소 테스트(멱등성/모드/실패 기록)
- [ ] Admin FE: `/bulk-cancel` 페이지 + 메뉴 연결
- [ ] Docs: 운영자 사용 방법(짧게)

---
