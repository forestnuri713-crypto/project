# Sprint 19 SSOT — Admin Visibility + Observability (Read-only)

> Sprint: **19**  
> Status: **PLANNING**  
> Branch: **sprint-19/admin-visibility-and-observability**  
> Baseline: Sprint 18 완료 상태 (Drill-down v1 + Static Visualization)  
> Source inputs: `status.md` + Sprint 19 Snapshot (this doc)  

---

## 0. Purpose

Sprint 19는 **Admin 대시보드의 Visibility(가시성) 확장**과 **Observability(관찰성) 강화**를 한다.

- **Backend 변경 없이 시작/완료**한다. (`apps/server diff = 0`)
- **Read-only 정책 유지** (쓰기/변경 UX 추가 금지)
- Drill-down(상세 진입)은 **“기존 endpoint가 존재할 때만” 활성화**
- 전역 리팩토링 금지 (로컬 중복 허용)

---

## 1. Hard Constraints (Non‑Negotiable)

### 1.1 Backend / Contract
- ✅ `apps/server` 변경 금지 (diff = 0)
- ✅ 신규 endpoint 금지
- ✅ DTO/Schema 수정 금지
- ✅ 기존 Error Envelope 계약 유지
  - 항상 표시: `error.message`, `error.code`, `error.requestId`
  - Envelope 구조 변경 금지
  - Retry는 **identical request 재발행**으로 구현

### 1.2 Frontend Architecture Guardrails
- ✅ URL → state authoritative (검색 파라미터가 SSOT)
- ✅ Server-side pagination only (클라 집계/필터로 derived metric 생성 금지)
- ✅ Static binding only (stats 값 그대로 렌더링)
- ✅ Disabled drill-down은 “명시적 UI 처리” (숨기지 말고 비활성 상태를 드러냄)
- ✅ 전역 pagination 추상화 유혹 금지 (Backlog로 미룸)

---

## 2. Scope & Milestones

### M1 — Drill-down Expansion Audit & Completion (필수)
**목표:** 현재 Admin UI에서 “드릴다운 후보”를 확장하되, **기존 endpoint가 실제로 있는 경우에만** 링크/진입을 활성화한다.

**작업:**
1) **Admin endpoint audit**
- 존재하는 Admin list endpoints(/admin/programs, /admin/instructors 등) + 현재 UI 페이지를 대조
- “통계 카드/표/차트”에서 연결 가능한 목록/상세 경로를 식별

2) **Missing drill-down targets 식별**
- 링크가 있어야 UX가 완성되나, endpoint가 없거나 페이지가 없으면 **비활성 처리**로 남긴다.

3) **Enable only valid drill-down**
- *유효성 기준:* (a) endpoint 존재, (b) 해당 페이지 라우트 존재, (c) URL-state 규칙을 깨지 않음  
- 유효하지 않으면 링크 disabled + tooltip/설명 텍스트

4) **URL authoritative 유지**
- 클릭 → `router.replace()`로 searchParams 갱신(히스토리 오염 방지)
- 새로고침 시 URL만으로 동일 상태 복원

**Acceptance Criteria:**
- Drill-down 링크는 “실제 존재하는 목록/상세”에만 활성화됨
- 비활성 drill-down은 사용자에게 이유가 노출됨(예: “준비 중(backend endpoint 없음)” 같은 문구)
- URL로 상태 복원 가능 (새로고침/공유 링크)

---

### M2 — Bulk Cancel Observability Upgrade (필수)
**목표:** Bulk Cancel UI에서 “관찰성”을 강화한다. (계산/집계 기반 시각화 금지)

**작업:**
- 에러/네트워크 실패 시:
  - `error.code`, `error.requestId` 노출 강화
  - Retry 버튼은 동일 요청 재발행
- Job/Items 조회의 상태 표시 개선:
  - 로딩/리프레시/재시도 상태가 화면에서 명확
  - deep-link(현재 URL) 복사 UX는 **다음 스프린트로 이연**(Deferred)

**Acceptance Criteria:**
- Bulk Cancel 관련 모든 에러 패널에서 code/message/requestId가 항상 보임
- 재시도는 동일 request를 재발행하며, 성공 시 화면이 일관되게 갱신됨
- “파생 지표 계산” 없이도 운영자가 문제를 추적할 수 있게 UI 정보가 보강됨

---

### (Optional) M3 — Visualization Refinement (비계산 기반)
- 시각적/레이아웃 polish
- 단, **derived metric 계산/재해석**은 금지 (값을 새로 만들지 말고 기존 데이터 표현만 개선)

---

## 3. Active Contracts (API Dependencies)

Sprint 19 구현은 아래 계약에만 의존한다. (추가 금지)

### 3.1 Dashboard
- `GET /admin/dashboard/stats`

### 3.2 Bulk Cancel
- `GET /admin/bulk-cancel-jobs/:jobId/items`
- `POST /admin/bulk-cancel-jobs/:jobId/retry`

### 3.3 Existing Admin list endpoints
- 예: `/admin/programs`, `/admin/instructors` 등 (현재 프로젝트에 존재하는 것만)

> **Rule:** Drill-down은 “해당 endpoint가 실제로 존재”할 때만 활성화한다.

---

## 4. Rendering & URL State Model

### 4.1 Authoritative URL
- UI 상태는 URL searchParams가 SSOT다.
- 내부 state는 “URL에서 파생된 캐시” 정도만 허용(불일치 금지).

### 4.2 Pagination
- Server-side pagination only
- Page clamp(초과 페이지 보정) 규칙 유지

### 4.3 Disabled Drill-down UX
- 비활성 상태를 숨기지 않는다.
- 예시 패턴:
  - 링크 스타일은 disabled
  - hover tooltip 또는 보조 텍스트로 사유 표시
  - 클릭은 no-op (또는 안내 toast)

---

## 5. Error Handling Rules (Envelope Contract)

- 에러 패널에는 항상 다음을 표시한다:
  - `error.message`
  - `error.code`
  - `error.requestId`
- Retry는 동일 요청을 다시 호출한다.
- Envelope 구조를 바꾸거나, 에러 내용을 새로 “가공”하지 않는다.

---

## 6. Risks & Mitigations

### R1) URL state coupling 확장
- **Mitigation:** searchParams 스키마를 페이지별로 문서화하고, 범용 전역 추상화는 backlog로 미룸.

### R2) Derived metric 해석 충돌
- **Mitigation:** stats 값은 그대로 표시. 비율/추세 등 파생 계산 금지.

### R3) 표현 계층 번들 증가
- **Mitigation:** 필요 UI만 로컬 컴포넌트로 추가. 전역 UI kit 확장 금지.

### R4) 전역 pagination 추상화 유혹
- **Mitigation:** 이번 스프린트에서는 “복붙 허용”하고, 추상화는 backlog.

---

## 7. Deferred Items

### NEXT SPRINT
- Bulk Cancel deep-link copy 개선
- Drill-down 대상 페이지 확장 (reservations/users endpoint가 존재할 경우)
- Visualization UX polish

### BACKLOG
- Global list abstraction
- Unified pagination component
- Metrics caching layer
- Aggregated analytics endpoint
- Redis 분산 락 제거 검토

---

## 8. status.md Update Checklist

`status.md`(최종 업데이트 2026-02-15 기준)에는 Sprint 18까지 완료로 기록되어 있음. Sprint 19 시작 반영이 필요.  
(상세 현황은 `status.md`에서 확인)  

필수 수정:
1) Sprint 테이블에 Sprint 19 행 추가  
   `| Sprint 19 | Admin Visibility + Observability | 진행 중 |`

2) “다음 단계” 섹션에서
- Sprint 19를 “현재 진행 중”으로 변경
- Sprint 18 관련 문구 제거

수정 불필요:
- Sprint 18 행(완료) 유지
- Phase 5 상태(완료 Read-only 1차) 유지

---

## 9. Implementation Plan (Frontend-only)

### 9.1 M1 — Drill-down Audit
- 현존 Admin 페이지 라우트 목록화 (`apps/admin/src/app/**`)
- API client에서 사용 중인 admin endpoints 목록화
- Dashboard stats 카드별 drill-down 후보 정의:
  - “어디로 가야 하는가?”(목표 라우트)
  - “URL params는 무엇인가?”(authoritative params)
  - “endpoint 존재 여부는?”(존재하면 enable / 아니면 disable)

### 9.2 M1 — Drill-down Completion
- 가능한 연결은 활성화
- 불가능한 연결은 disabled + 이유 표기
- router.replace 기반 URL sync
- 새로고침 복원 스모크 테스트

### 9.3 M2 — Bulk Cancel Observability
- 에러 패널 통일: message/code/requestId
- Retry 동일 요청 재발행
- 로딩/갱신 상태 명확화(스피너/텍스트)
- jobId deep-link 복원 흐름 유지

---

## 10. Definition of Done (DoD)

- [ ] `apps/server` 변경 없음 (git diff 확인)
- [ ] Drill-down은 존재하는 endpoint/페이지에만 enable
- [ ] Disabled drill-down은 명시적으로 표시 + 이유 제공
- [ ] URL state authoritative (새로고침/공유 링크로 복원)
- [ ] Bulk Cancel 에러 패널에서 message/code/requestId 항상 노출
- [ ] Retry는 identical request 재발행
- [ ] 전역 리팩토링/전역 pagination 추상화 없음
- [ ] `pnpm lint` / `pnpm test` (해당 워크스페이스 기준) 통과

---

## 11. Minimal Next Session Starter Prompt (Copy-Paste)

We are starting Sprint 19 (Admin Visibility + Observability).

Context:
- Sprint 18 completed (Drill-down v1 + Static Visualization).
- No backend changes. apps/server diff must remain 0.
- Read-only policy enforced.
- Error envelope + requestId must be preserved and shown (message/code/requestId).

Objective:
Execute M1 — Drill-down Expansion Audit & Completion.

Tasks:
1) Audit existing admin list endpoints and pages.
2) Identify missing drill-down targets.
3) Enable only valid drill-down links (endpoint+page exist).
4) Keep URL authoritative (searchParams as SSOT, router.replace).
5) Do not introduce backend or global refactors.
Focus on correctness and contract safety. Do not generate backend code.
