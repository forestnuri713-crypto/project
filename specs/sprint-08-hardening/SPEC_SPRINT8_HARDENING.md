# SPEC Sprint 8 — Hardening (Full)
SSOT (Single Source of Truth). 구현·리뷰·테스트는 본 문서를 기준으로 한다.

---

## 0. Context
- Monorepo: Turborepo + pnpm
- Backend: NestJS (`apps/server`)
- Admin FE: Next.js (`apps/admin`)
- DB: Prisma (`apps/server/src/prisma/schema.prisma`)
- 최근 완료:
  - Sprint 6: Reviews + migration
  - Sprint 7: Rain bulk-cancel (Mode A/B) + migration + SSOT
- 목표: 기능 추가보다 **품질/일관성/재현성**을 고정하여, Sprint 9+에서 리팩터링 비용을 제거

---

## 1. Decisions / Defaults (모호하면 이 섹션을 따른다)
- 스프린트 목표는 “새 기능”이 아니라 “규약/인프라 고정”이다.
- Prisma migrations는 **항상 git에 포함**한다(강제 add -f 필요 없게).
- API 오류 응답은 공통 포맷(ApiError)을 사용한다.
- 로그 레벨 규약:
  - 예상 가능한 부분 실패(외부연동/개별 아이템 실패) = WARN
  - 시스템 장애(코드 버그, DB down, 예상치 못한 예외) = ERROR
- 상태/판정 로직은 “도메인 유틸/폴더”로 모아 서비스에서 재사용한다.
- 표준 검증 커맨드는 루트 `package.json`에 고정한다.

---

## 2. Goals
- (P0) Prisma migration 커밋 정책 고정
- (P0) API 에러 코드/형식 표준화
- (P0) Logger 레벨/포맷 규약 고정
- (P1) 상태 enum/전이 판정 함수 표준화(도메인 레이어)
- (P1) 테스트/CI 표준 커맨드 고정

---

## 3. Scope

### 3.1 P0 — Prisma migrations Git Policy
#### 변경
- `.gitignore`에서 `apps/server/src/prisma/migrations`가 무시되는 규칙을 제거하거나 예외 처리한다.
- migrations 디렉토리 구조는 Prisma 기본을 따른다.

#### Acceptance Criteria
- AC-MIG-1: `prisma migrate dev`로 생성된 migrations가 **일반 git add로 추가**된다.
- AC-MIG-2: 팀원이 새 환경에서 `git clone` 후 `prisma migrate deploy`(또는 dev)로 동일 스키마 재현 가능하다.
- AC-MIG-3: “migrations가 gitignore라서 -f 필요” 문제가 재발하지 않는다.

---

### 3.2 P0 — API Error Standardization (ApiError)
#### 표준 응답 포맷 (Fixed)
모든 4xx/5xx 에러는 아래 포맷으로 응답한다.
```json
{
  "code": "STRING_ENUM",
  "message": "human readable string",
  "details": {}
}
```

- code는 안정적인 문자열(대문자 스네이크 권장)
- message는 사용자/운영자가 이해 가능한 문장(한국어/영어는 현 프로젝트 규칙에 따름)
- details는 디버깅용 부가정보(필요시)

#### 구현 가이드
- NestJS ExceptionFilter(또는 Interceptor)로 공통 변환
- ValidationPipe 오류도 ApiError로 변환(가능하면)

#### 최소 적용 범위 (Sprint 8에서 반드시)
- Sprint 6 Reviews 관련 Admin/Public 엔드포인트
- Sprint 7 Bulk Cancel 관련 Admin 엔드포인트

#### 예시 code 목록 (초안, 필요 시 확장)
- VALIDATION_ERROR
- UNAUTHORIZED
- FORBIDDEN
- NOT_FOUND
- CONFLICT
- REVIEW_ALREADY_EXISTS
- REVIEW_NOT_ALLOWED
- BULK_CANCEL_JOB_RUNNING
- BULK_CANCEL_JOB_COMPLETED
- BULK_CANCEL_JOB_NOT_FOUND
- PG_REFUND_FAILED
- NOTIFICATION_FAILED

#### Acceptance Criteria
- AC-ERR-1: Bulk cancel “running job” 충돌은 409 + code=BULK_CANCEL_JOB_RUNNING
- AC-ERR-2: 리뷰 중복 작성은 409 + code=REVIEW_ALREADY_EXISTS
- AC-ERR-3: 프론트(관리자/모바일)에서 code 기반 분기 처리가 가능하다.

---

### 3.3 P0 — Logging Standardization
#### 규약 (Fixed)
- WARN: 예상 가능한 부분 실패(외부 연동 실패, 아이템 단위 실패)이며 데이터로 실패 기록이 남는 경우
- ERROR: 시스템 장애 또는 예상치 못한 예외(프로세스 지속이 위험한 경우)

#### 구현 가이드
- Logger wrapper 유틸 제공(선택)
- 로그 메시지에 최소 필드 포함:
  - feature (reviews/bulk-cancel)
  - id (jobId/reservationId/reviewId 등)
  - code (ApiError code 또는 내부 failureCode)

#### Acceptance Criteria
- AC-LOG-1: BulkCancel의 PG 환불 실패는 WARN로 기록된다.
- AC-LOG-2: 시스템 예외만 ERROR로 남는다.
- AC-LOG-3: 테스트/CI 로그에서 “의미 없는 ERROR”가 제거된다.

---

### 3.4 P1 — Domain Status / Transition Utilities
#### 목적
- 서비스 내부에 분산된 상태 판정 로직을 통합하여 재사용/테스트 가능하게 한다.

#### 제안 위치 (Fixed)
- `apps/server/src/domain/` 또는 `apps/server/src/common/domain/` (레포 규칙에 맞게 하나로 고정)

#### 제공해야 할 최소 함수 (Sprint 8에서 반드시)
- `canWriteReview(reservation, attendance): boolean`
- `isTerminalReservationStatus(status): boolean`
- `shouldSkipBulkCancel(reservation): boolean`  // 이미 취소/종료 등
- `getRefundMode(paymentsServicePresent: boolean, configEnabled: boolean): "A_PG_REFUND"|"B_LEDGER_ONLY"`

#### Acceptance Criteria
- AC-DOM-1: ReviewsService, AdminBulkCancelService는 위 유틸을 호출한다.
- AC-DOM-2: 상태 판정 로직이 서비스에 중복 구현되지 않는다.
- AC-DOM-3: 유틸은 단위 테스트 가능하거나(권장) 서비스 테스트에서 간접 검증된다.

---

### 3.5 P1 — Standard Test/CI Commands
#### 목표
- 개발자/CI가 동일한 커맨드로 검증할 수 있게 루트 스크립트를 고정한다.

#### 루트 package.json에 추가할 스크립트 (권장)
- `test:server` → server jest
- `test:all` → 전체 jest(또는 -r)
- `typecheck:server` → server tsc --noEmit
- `typecheck:all`
- `build:all`
- `lint` (이미 있으면 정리)

#### Acceptance Criteria
- AC-CMD-1: `pnpm test:all` PASS
- AC-CMD-2: `pnpm typecheck:all` PASS
- AC-CMD-3: `pnpm build:all` PASS

---

## 4. Non-Goals
- 신규 기능(카테고리/검색/멤버 초대 등) 추가
- 대규모 리팩터링(폴더 구조 전면 개편, ORM 교체 등)
- OpenAPI 전체 자동화(선택 사항, Sprint 9 이후로 미룸)

---

## 5. Deliverables Checklist
- [ ] `.gitignore` / git policy 정리: migrations 기본 추적
- [ ] ApiError 표준 구현(ExceptionFilter/Interceptor) + 적용(Reviews/BulkCancel)
- [ ] Logging 규약 정리 + BulkCancel/Reviews에 적용
- [ ] Domain utilities 폴더 생성 + 최소 판정 함수 구현 + 서비스에서 사용
- [ ] 루트 package.json 표준 커맨드 추가 + 문서화
- [ ] 회귀 테스트 통과 + 빌드/타입체크 통과

---

## 6. Verification (Definition of Done)
- `pnpm test:all` PASS
- `pnpm typecheck:all` PASS
- `pnpm build:all` PASS
- 새 migration 생성 시 -f 없이 git add 가능
- Reviews/BulkCancel 주요 에러가 ApiError(code)로 응답
- BulkCancel 예상 실패는 WARN, 시스템 장애는 ERROR
