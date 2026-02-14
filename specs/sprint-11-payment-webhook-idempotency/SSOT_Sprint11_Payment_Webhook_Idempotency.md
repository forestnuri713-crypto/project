# Sprint 11 SSOT — Payment Webhook Idempotency (PortOne)
> Project: 숲똑(SoopTalk) 숲체험 예약 플랫폼  
> Date: 2026-02-14  
> Scope owner: Backend (apps/server) + Shared types (packages/shared)  
> Goal: **웹훅 중복/재시도/순서 뒤바뀜(out-of-order)** 환경에서도 결제·예약·정산 상태가 **정확히 1회만** 전이되도록 보장

---

## 0) Context (현재 상태)
- 결제 모듈: **PortOne** 연동 완료 (Phase 2)  
- 정산 시스템 + 어드민 API: 완료 (Phase 4)  
- 예약 정합성/동시성 강화: 완료 (Sprint 10)  
- 이제 결제 웹훅도 동일한 수준으로 **중복 안전성**을 올려서, “중복 결제 반영/중복 예약 확정/중복 정산 반영”을 원천 차단한다.

---

## 1) Non-goals (이번 Sprint에서 하지 않는 것)
- PG/PortOne 결제 승인 로직 자체의 재작성
- 결제 UX(프론트) 개편
- 정산 도메인 재설계(단, 중복 방지용 지급/정산 idempotency 키는 추후 확장 가능)

---

## 2) Problems to solve
1. **At-least-once delivery**: 동일 웹훅 이벤트가 여러 번 온다.
2. **Out-of-order**: 이벤트 순서가 바뀔 수 있다. (예: paid → failed가 늦게 도착)
3. **Partial failure**: DB 트랜잭션 중 오류가 나면 PortOne이 재시도한다.
4. **Race**: 동일 merchant_uid(주문) 기준으로 동시에 여러 요청이 들어올 수 있다.

---

## 3) Definitions / Invariants
### 3.1 용어
- **merchant_uid**: 주문(우리 시스템) 식별자 — 내부 Payment/Reservation에 연결되는 SSOT 키
- **imp_uid / payment_id**: PortOne 거래 식별자(존재 시)
- **webhook event id**: PortOne이 제공하는 이벤트 식별자(존재 시). 없으면 안전한 대체키를 구성한다.

### 3.2 시스템 불변조건 (Invariant)
- 결제 단일 주문(merchant_uid) 기준:
  - `PAID`(결제확정)로의 상태 전이는 **단 1회**
  - 예약 확정(예: Reservation.status=CONFIRMED / paidAt set)도 **단 1회**
  - 같은 주문에 대해 웹훅이 10번 와도 결과는 동일(멱등)

---

## 4) Design overview (2-layer idempotency)
### Layer A — Webhook Event Idempotency (이벤트 중복 제거)
- 웹훅 요청을 받으면 **이벤트 단위 로그 테이블**에 먼저 기록한다.
- `(provider, eventKey)`를 **UNIQUE**로 강제해 “같은 이벤트”는 1번만 처리되게 한다.
- 이미 처리된 이벤트면 **200 OK**로 즉시 종료 (PortOne 재시도 중단 유도)

### Layer B — Domain Idempotency (주문/결제 상태 머신 멱등)
- 이벤트가 최초 처리라도, 도메인 상태는 항상 “현재 상태를 보고” 안전하게 전이한다.
- `merchant_uid` 기준 Payment row를 잠그거나(SELECT ... FOR UPDATE) 유사 효과로 충돌을 방지한다.
- 이미 `PAID`면 이후 paid 이벤트는 noop.

---

## 5) Data model (Prisma)
> 실제 Prisma 명칭/관계는 기존 프로젝트 모델에 맞춰 조정한다. 아래는 **핵심 필드/인덱스가 SSOT**.

### 5.1 New: PaymentWebhookEvent
**Purpose**: 중복 이벤트 제거 + 감사/추적 로그(“어떤 웹훅이 무엇을 했나”)

필수 필드:
- `id` (uuid/cuid)
- `provider` (enum: PORTONE)
- `eventKey` (string) — UNIQUE with provider
- `merchantUid` (string, nullable 가능) — 파싱 실패 대비
- `eventType` (string) — paid / cancelled / failed 등
- `receivedAt` (datetime)
- `status` (enum: RECEIVED | PROCESSED | IGNORED | FAILED)
- `processedAt` (datetime nullable)
- `attempt` (int, default 1) — 같은 eventKey 재시도 시 업데이트(선택)
- `rawBody` (Json or string) — 저장 용량 고려(필요시 일부만)
- `signature` / `headers` (optional) — 추적용

Indexes:
- `@@unique([provider, eventKey])`
- `@@index([merchantUid])`
- `@@index([receivedAt])`

### 5.2 Existing: Payment / Reservation (확인 포인트)
- Payment는 최소:
  - `merchantUid` UNIQUE
  - `status` (PENDING | PAID | CANCELLED | FAILED 등)
  - `paidAt`, `cancelledAt`, `failedAt` 등 타임스탬프(있으면 활용)
  - `providerPaymentId`(imp_uid 등) 저장 가능

- Reservation은 최소:
  - 결제 확정 시 1회 전이되는 필드(예: `status`, `paidAt`, `paymentId` FK 등)

---

## 6) EventKey strategy (PortOne)
### 6.1 Prefer: PortOne event id
- PortOne이 webhook payload에 event id를 제공하면 그 값을 `eventKey`로 사용

### 6.2 Fallback: deterministic composite key
event id가 없거나 신뢰하기 어렵다면 아래 우선순위로 조합한다.

권장 구성(예시):
- `eventKey = sha256(provider + ":" + eventType + ":" + merchant_uid + ":" + imp_uid + ":" + paid_at_or_created_at)`
- 최소는 `eventType + merchant_uid + imp_uid`이지만, cancel/paid 이벤트 충돌을 피하려면 시간 또는 unique 속성을 포함한다.

**주의**: fallback 키는 “동일 이벤트 재전송”을 같은 키로 맞추는 것이 목적이므로,
- payload의 변동 가능한 필드(예: amount formatting 등)는 가급적 제외
- 가능한 PortOne이 제공하는 고유값을 우선 사용

---

## 7) Webhook handler flow (SSOT)
### 7.1 Handler contract
- 엔드포인트: `POST /payments/portone/webhook` (명칭은 현재 코드에 맞춤)
- 응답:
  - 정상(처리/중복 포함): **200**
  - 서명/검증 실패: **401/403** (단, PortOne 정책에 맞춰 200으로 무시할지 결정)
  - 서버 오류(일시적): **500** (PortOne 재시도 유도)

### 7.2 Pseudocode (핵심)
1) **Parse + verify signature**
2) Extract: `eventType`, `merchantUid`, `impUid`, `eventId`, `eventTime`
3) `eventKey = eventId || fallbackKey(...)`

4) DB tx 시작
   - INSERT PaymentWebhookEvent(provider,eventKey,...)  
     - UNIQUE 충돌이면: 이미 처리됨 → tx 종료 → 200 OK
   - Payment row 조회(merchantUid) + 필요 시 lock
   - switch(eventType):
     - paid:
       - if Payment.status == PAID: mark webhook event IGNORED, commit
       - else:
         - (옵션) PortOne 결제 조회 API로 amount/status 검증
         - Payment.status=PAID, paidAt set, providerPaymentId set
         - Reservation 확정 전이(딱 1회): status=CONFIRMED, paidAt set 등
     - cancelled:
       - if Payment.status in [CANCELLED]: IGNORED
       - else if Payment.status != PAID: 정책 결정(미결제 취소 처리?) → IGNORED or FAILED
       - else:
         - Payment.status=CANCELLED, cancelledAt set
         - Reservation 취소 전이(정책에 따라)
     - failed:
       - if Payment.status in [PAID]: IGNORED (out-of-order 보호)
       - else Payment.status=FAILED
   - webhook event status=PROCESSED, processedAt set
5) commit
6) return 200

---

## 8) Ordering rules (out-of-order)
권장 우선순위(보수적):
- `PAID`가 한번 확정되면, 이후 `FAILED`/`CANCELLED` 이벤트는 **추가 검증 없이 상태를 되돌리지 않는다.**
  - 단, “취소”는 실제 결제 취소가 PortOne에서 확정된 경우에만 반영(가능하면 PortOne 조회로 확인)
- 실패/취소가 먼저 와도, 이후 PAID가 오면 **PAID**로 전이 가능(조회 검증 권장)

---

## 9) Validation (optional but recommended)
- paid/cancelled 이벤트 처리 시 PortOne 조회 API로 아래 확인:
  - merchant_uid 일치
  - 결제 상태 일치
  - 결제 금액 일치(서버의 expected amount와 비교)
- 검증 실패 시:
  - PaymentWebhookEvent.status=FAILED
  - 500을 반환할지(재시도) / 200으로 무시할지(운영 정책) 결정

---

## 10) Observability
- 로그(Structured):
  - `eventKey`, `merchantUid`, `eventType`, `result(PROCESSED/IGNORED/FAILED)`, `reason`
- 메트릭(가능하면):
  - webhook_received_total
  - webhook_deduped_total
  - webhook_processed_total
  - webhook_failed_total
- 알림:
  - FAILED가 일정 횟수 이상이면 Slack/FCM/Email 등(후속 Sprint 가능)

---

## 11) Migration / Rollout plan
1) Prisma migration: PaymentWebhookEvent table + indexes
2) Handler에 dedup + domain idempotency 적용
3) 스테이징에서 PortOne sandbox로:
   - 동일 이벤트 5회 재전송 테스트
   - 순서 뒤바뀜(가능하면 시뮬레이터) 테스트
4) 프로덕션:
   - 초기에는 rawBody 저장을 최소화(용량)
   - 장애 시에도 “중복처리 방지”가 유지되는지 확인

---

## 12) Test plan (must-have)
### Unit
- eventKey 생성(있을 때/없을 때)
- paid/cancelled/failed 상태 전이 규칙

### Integration (DB)
- 같은 eventKey로 2번 요청 → 1번만 도메인 변경
- paid 이벤트 2번 → Payment/Reservation 1회만 확정
- failed 후 paid → paid로 전이
- paid 후 failed → paid 유지(ignored)

### Load / Concurrency
- 동시에 같은 merchant_uid paid 이벤트 10개 → 결과 1회 확정 + 9회 ignored/dedup

---

## 13) Done criteria (Sprint 11)
- [ ] PaymentWebhookEvent 테이블/마이그레이션 추가
- [ ] webhook handler: 이벤트 dedup + 도메인 멱등 처리
- [ ] 최소 통합 테스트 4종(중복/순서/경합)
- [ ] 로그에 eventKey/merchantUid/result 포함
- [ ] 운영 문서(본 SSOT) 최신화
