# Sprint 14 SSOT — 숲똑(SoopTalk) 예약 플랫폼

> 목적: Sprint 14 개발의 **단일 진실원천(SSOT)** 문서.  
> 최종 업데이트: 2026-02-14  
> 기준 커밋: `d2ef6c7` (main, tag: `sprint-13-complete`)  
> 빌드 기준: `tsc --noEmit` PASS, `jest` ALL PASS

---

## 0) 현재 상태 요약 (Sprint 13까지)

- Phase 0~4 완료(모노레포, Auth/예약 MVP, 결제, 알림/사진첩, 정산+어드민 API)  
- Phase 5(어드민 대시보드 프론트) **미착수**
- 예약 정원은 **ProgramSchedule.remaining_capacity** 기반 원자적 증감으로 동시성 안전 확보(Sprint 13)

> 참고: 상세 현황은 `status.md`를 소스 오브 트루스로 둔다.

---

## 1) Sprint 14 목표

### 1.1 핵심 목표
- Sprint 14에서 처리할 **주제(topic)** 를 중심으로, 기능/버그를 **작은 PR 단위**로 안정적으로 병합한다.
- “브랜치 → PR → main 머지” 고정으로 이력/리뷰/롤백을 단순화한다.
- `jest`, `tsc --noEmit` 녹색 상태를 **항상 유지**한다.

### 1.2 성공 기준(Definition of Done)
- [ ] Sprint 14의 각 PR은 아래 PR 체크리스트를 충족
- [ ] 모든 PR은 **SSOT 섹션(진행/결정/리스크/테스트/롤백)** 업데이트 포함
- [ ] main은 **PR merge로만 변경**(직접 push 금지)
- [ ] Sprint 14 완료 시 `sprint-14-complete` 태그 푸시

---

## 2) Sprint 14 운영 규칙 (브랜치/PR/머지)

### 2.1 브랜치 네이밍
- `sprint-14/<topic>` (권장)
  - 예: `sprint-14/reservation-ui`, `sprint-14/payment-webhook`

### 2.2 작업 흐름(SSOT 포함)
1) 브랜치 생성
```bash
git checkout main
git pull
git checkout -b sprint-14/<topic>
```

2) 구현 + 테스트
```bash
cd apps/server
npx jest
npx tsc --noEmit
```

3) SSOT 업데이트(완료 체크/결정사항 기록)
- 이 문서의 **3) 작업 항목**, **4) 결정사항**, **5) 테스트/검증**, **6) 롤백/리스크** 업데이트

4) 커밋 규칙(최소 2~3개 권장)
- `feat(s14): ...`
- `test(s14): ...`
- `docs(s14): update SSOT`

5) push 후 PR 생성
```bash
git push -u origin sprint-14/<topic>
```

### 2.3 PR 템플릿 (본문에 그대로 붙여넣기)
- 제목: `Sprint 14 - <topic>`
- 본문 체크리스트:
  - [ ] SSOT 업데이트 완료
  - [ ] jest 통과
  - [ ] tsc 통과
  - [ ] 마이그레이션/백필 있으면 적용/검증
  - [ ] 롤백/에러케이스 고려

### 2.4 머지 방식
- **Squash merge 권장**
  - main을 “스프린트 단위 단일 커밋” 성격으로 유지 가능
  - PR 본문을 릴리즈 노트로 활용

### 2.5 완료 표식(태그)
PR 머지 후:
```bash
git checkout main
git pull
git tag sprint-14-complete
git push origin sprint-14-complete
```

> 가장 중요한 한 줄: **main에는 PR 머지로만 들어간다.**  
> (핫픽스도 `hotfix/...` 브랜치 → PR)

---

## 3) Sprint 14 작업 항목 (Backlog → In Progress → Done)

> 아래는 **토큰 절약**을 위해 “작은 PR 단위” 체크리스트 형태로 유지한다.  
> Sprint 14의 첫 주제가 정해지면, 각 항목에 **명확한 Acceptance Criteria**를 붙인다.

### 3.1 Backlog (TBD)
- (비어있음)

### 3.2 In Progress
- (비어있음)

### 3.3 Done
- [x] Topic 1: admin-api-contract-stabilization
  - 범위:
    - [x] API: 6개 admin query DTO에 `@Max(100)` + `resolvedLimit` getter 추가
    - [x] API: `AdminQueryProvidersDto`에 `search`/`query` alias + `resolvedSearch` getter
    - [x] API: `QueryBulkCancelItemsDto`에 `limit`/`pageSize` alias + `resolvedLimit` getter
    - [x] Service: `admin.service.ts` 5개 메서드 `resolvedLimit`/`resolvedSearch` 사용
    - [x] Service: `admin-bulk-cancel.service.ts` `getJobItems` param/response `pageSize` → `limit`
    - [x] Controller: `getBulkCancelJobItems` → `query.resolvedLimit` 사용
    - [x] 테스트: `review.spec.ts`, `admin-provider.spec.ts` DTO 인스턴스 사용으로 수정
    - [x] 문서/SSOT
  - Acceptance Criteria:
    - [x] 모든 admin list 응답이 `{ items, total, page, limit }` 형태
    - [x] deprecated alias(`pageSize`, `query`) 여전히 동작 (non-breaking)
    - [x] `limit` 최대 100 제한 (`@Max(100)` + `resolvedLimit` clamp)
    - [x] `tsc --noEmit` PASS
    - [x] Sprint 14 관련 jest 테스트 PASS (pre-existing 실패 2건은 Sprint 13 범위)

---

## 4) 핵심 설계/정책 결정(Decision Log)

> PR마다 “무엇을 왜 이렇게 했는지”를 1~3줄로 남긴다.

- (예시) 2026-02-14 — [결정] remaining_capacity를 정원 제어의 유일 기준으로 유지(analytics용 reserved_count와 분리)

### Sprint 14 결정사항
- 2026-02-14 — [프로세스] Sprint 14부터 브랜치→PR→main 머지 고정, Squash merge 권장
- 2026-02-14 — [계약] admin list API 응답 기본 shape: `{ items, total, page, limit }`. Non-breaking: deprecated alias(`pageSize`→`limit`, `query`→`search`) DTO getter로 수용
- 2026-02-14 — [계약] `limit` 최대값 100 (`@Max(100)` 검증 + `resolvedLimit` clamp). 기본값 20
- 2026-02-14 — [계약] `getJobItems` (bulk-cancel) 응답에 `totalPages` 추가 필드 허용 (base contract 확장, additive)

---

## 5) 테스트/검증 계획

### 5.1 공통 로컬 검증
- `cd apps/server`
- `npx tsc --noEmit`
- `npx jest`

### 5.2 admin-api-contract-stabilization 검증
- [x] `npx tsc --noEmit` — PASS
- [x] Sprint 14 scope tests PASS; 2 pre-existing failing suites tracked separately (not Sprint 14 scope):
  - `reservation-cancel.spec.ts` — Sprint 13 CP3 `tx.reservation.findUnique` mock 누락
  - `reservation-schedule.spec.ts` — Sprint 13 atomic decrement mock 미반영
- [x] `review.spec.ts` — findReviews contract test with DTO instance (PASS)
- [x] `admin-provider.spec.ts` — findProviders contract test with alias pageSize→limit (PASS)
- 마이그레이션/백필: 해당 없음 (코드 전용 변경)
- 에러 계약: 기존 계약 유지 (non-breaking alias only)

---

## 6) 리스크/롤백/운영 고려사항

### 6.1 admin-api-contract-stabilization 리스크
- [x] 에러 케이스: non-breaking — deprecated alias 여전히 동작, 기존 클라이언트 영향 없음
- [x] 데이터 무결성: DB 변경 없음 (코드 전용)
- [x] 성능: 변경 없음 (쿼리 로직 동일, 파라미터명만 변경)

### 6.2 롤백 전략
- admin-api-contract-stabilization: **revert commit, no DB impact**. 코드 전용 변경이므로 커밋 revert로 즉시 원복 가능
- DB 스키마 변경 (일반 원칙):
  - 가능하면 **forward-only**로 설계(새 컬럼 추가 → 코드 전환 → 구 컬럼 제거는 다음 스프린트)
- 기능 플래그(필요 시):
  - 최소한의 환경변수/설정으로 on/off 가능하게 설계
- 운영 영향:
  - 마이그레이션은 deploy 단계에서 명시적으로 수행(`migrate deploy`)

---

## 7) Sprint 14 작업 시작 체크리스트 (개발자용)

- [ ] Sprint 14의 첫 주제(topic) 확정
- [ ] `sprint-14/<topic>` 브랜치 생성
- [ ] PR 템플릿 본문 준비
- [ ] SSOT의 3) Backlog에 항목 생성 + Acceptance Criteria 작성
- [ ] 구현 → 테스트 → SSOT 업데이트 → 커밋(2~3개) → push → PR

---

## 8) Claude Code 작업 지시문 (이 SSOT를 읽고 코딩하기)

> 아래 블록을 **클로드 코드(Claude Code)** 에 그대로 붙여 넣어 사용한다.  
> 목표: 토큰을 아끼되, 구현 누락 없이 안정적으로 PR을 만든다.

### 8.1 Claude Code 프롬프트 (템플릿)
```
너는 숲똑(SoopTalk) 모노레포의 코딩 에이전트다.
다음 SSOT 문서를 최우선으로 읽고, 문서에 적힌 범위/결정/테스트/롤백 규칙을 지켜서 작업한다.

1) 이 파일을 먼저 읽어: SPEC_SPRINT14_SSOT.md
2) status.md를 읽어 현재 구조/제약(remaining_capacity, BusinessException/ApiError 계약 등)을 파악해.
3) 내가 지정하는 Sprint 14 topic에 대해:
   - 필요한 변경 파일 목록(신규/수정) 예측
   - DB/Prisma 변경이 있으면 마이그레이션 계획(백필 포함, idempotent)
   - API 계약(요청/응답/에러코드)
   - 테스트 계획(jest)과 최소 테스트 케이스
   - 롤백/에러케이스
를 먼저 '계획'으로 15줄 이내로 제시한 다음 구현해.

구현 규칙:
- main 브랜치에는 직접 커밋/푸시하지 않는다(브랜치→PR).
- 커밋은 최소 2개: feat(s14) / test(s14) (+ 필요 시 docs(s14)).
- 구현 후 반드시 아래를 실행하고 결과를 보고해:
  cd apps/server && npx tsc --noEmit && npx jest
- 마지막에 SPEC_SPRINT14_SSOT.md의 3) 작업 항목과 4) 결정사항, 5) 테스트, 6) 리스크/롤백을 갱신할 diff를 제시해.
```

### 8.2 Claude Code 실행 커맨드 예시(로컬에서)
- Topic 예시: `reservation-ui` 라고 가정
```bash
git checkout main
git pull
git checkout -b sprint-14/reservation-ui
# Claude Code 실행(사용자 환경에 맞게)
# claude-code "위 프롬프트 + topic 상세"
```

---

## 9) Sprint 14 Topic 빠른 선택 가이드 (추천 후보)

> 아래 중 하나를 첫 topic으로 잡으면 “구멍 없이” 진행하기 쉽다.

1) **Phase 5 착수 전 준비**: 어드민 대시보드용 API 정리/스키마 문서화(변경 최소)
2) **예약 UX 강화**: ProgramSchedule 기준 예약 조회/필터/정렬(서버 API 확장 + 테스트)
3) **운영 안정성**: reconcile-capacity 스크립트/모니터링 쿼리 확장(데이터 정합성)
4) **결제/웹훅 하드닝**: PortOne webhook 에러케이스/재시도/로그 강화(아이템포턴시 점검)
5) **알림 비용 캐시 안정화**: 잔액 부족/동시 차감 경쟁 조건 테스트 추가

(원하는 첫 topic을 정하면, 위 3) 섹션에 Acceptance Criteria를 구체화해서 바로 착수한다.)
