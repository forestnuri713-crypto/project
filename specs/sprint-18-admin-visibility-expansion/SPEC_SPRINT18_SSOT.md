# Sprint 18 SSOT — Admin Read-only Visibility Expansion (Phase 5)

> 프로젝트: 숲똑(SoopTalk) — 숲체험 예약 플랫폼  
> Sprint: **18**  
> Phase: **5 (Admin Dashboard Frontend)**  
> 작성일: **2026-02-15**  
> 상태: **PLANNING (SSOT 확정)**

---

## 0) 배경 / 현재 기준선 (Sprint 17 종료)

Sprint 17에서 완료된 내용(코드 구현 완료, PR 준비):
- Bulk Cancel `/bulk-cancel` 내 **Step 4 임베디드**로 Job items 페이지네이션/URL 동기화/Retry 구현(CP5 M4)
- Admin Dashboard route는 `/` (App Router root)
- Dashboard stats: `GET /admin/dashboard/stats` 기반 **5개 카드 렌더링** + skeleton + error/retry
- URL state가 authoritative (특히 bulk-cancel items view)

Backend:
- **apps/server diff = 0** (변경 없음)
- **API 계약 변경 없음**, 기존 error envelope(Structured Error + requestId) 유지

---

## 1) Sprint 18 목표

**운영 가시성(Operational Visibility)** 을 확장하되:
- **Read-only 정책** 유지
- **Backend 변경 없이 시작**
- **기존 API 계약/에러 envelope/URL authoritative** 일관성 유지
- **전역 리팩토링(공용 리스트/공용 페이지네이션 추상화)** 금지

Sprint 18의 핵심 문장:
> “데이터를 새로 만들지 말고, 이미 있는 데이터를 더 잘 보여라.”

---

## 2) 비협상 계약 (Non-negotiable)

### 2.1 API Contracts (변경 금지)
- `GET /admin/bulk-cancel-jobs/:jobId/items`
- `POST /admin/bulk-cancel-jobs/:jobId/retry`
- `GET /admin/dashboard/stats` → direct object
  ```ts
  { totalUsers, totalReservations, totalRevenue,
    pendingPrograms, pendingInstructors }
  ```

### 2.2 렌더링/상태 모델
- URL → state restoration **authoritative**
- Server-side pagination only (client-side slicing 금지)
- Derived metric computation 금지 (새 계산/집계 금지)

### 2.3 에러 핸들링
- unified error envelope 사용
- 항상 렌더:
  - `error.message`
  - `error.code`
  - `error.requestId`
- Retry는 **동일 요청**을 재발행(파라미터 동일)

### 2.4 제약
- Backend 변경 금지(초기 단계)
- 신규 endpoint 금지
- DTO/Schema 수정 금지
- “전역” 추상화/리팩토링 금지 (필요 시 국소적 중복 허용)

---

## 3) Sprint 18 방향(2~3개) + 선정

### Direction A — Dashboard Drill-down (Read-only Navigation)
대시보드 숫자만으로는 “왜?”를 알 수 없다.  
카드 클릭 → 관련 리스트/필터 페이지로 이동하여 운영자가 바로 확인.

**원칙**
- 기존 Admin 리스트 endpoint 재사용(있는 것만)
- URL에 필터/페이지를 표현하고 새로고침 시 복원
- pagination은 서버 사이드만

예시(실제 라우트/쿼리는 현재 Admin 구현에 맞춤):
- pendingPrograms 카드 → `/programs?status=pending`
- pendingInstructors 카드 → `/instructors?status=pending`
- totalReservations 카드 → `/reservations` (있다면)
- totalUsers 카드 → `/users` (있다면)

> ⚠ 실제로 어떤 목록 엔드포인트/페이지가 이미 존재하는지 “audit” 후 확정.

### Direction B — Metrics Visualization (No backend timeseries)
시계열 데이터는 없으므로, **스냅샷 기반 시각화**만.
- 단순 Bar/Donut(“표현”만)  
- 새로운 계산/집계 금지 → stats object 값 그대로 바인딩

### Direction C — Bulk Cancel Observability Polish
- requestId copy
- status badge 개선
- retry 피드백(엄격히 server sync)

**Sprint 18 기본 선택안**
- **M1: Direction A (Drill-down)**
- **M2: Direction B (Visualization)**
- Direction C는 M3로 이관(시간 남으면 수행)

---

## 4) Milestones (Sprint 18 Scope)

### M1 — Dashboard Drill-down (Read-only Navigation)
**Scope**
- Dashboard 카드(5개) 각각에 “이동” affordance 추가(버튼/링크)
- 대상 페이지가 존재하는 항목만 활성화(없는 경우 disabled + tooltip)
- URL 필터/페이지 파라미터 설계 및 복원 로직 정리

**Guardrails**
- 기존 페이지/endpoint 재사용 (없으면 새로 만들되, backend 변경은 금지)
- URL authoritative 유지
- 전역 공용 컴포넌트 추출 금지(필요 시 로컬 컴포넌트)

**Acceptance Criteria**
- 카드 클릭 → 대응 페이지로 이동(가능한 경우)
- 새로고침 시 URL 기반 상태 복원
- 에러 시 `message/code/requestId` + retry 동작 동일
- SSR/CSR hydration 이슈 없음

---

### M2 — Dashboard Visualization Layer (Static Binding)
**Scope**
- stats object를 사용해 2~3개 차트(또는 시각 카드) 렌더
- skeleton/loading/error 상태는 기존과 동일 규칙 적용
- 라이브러리 도입 시 최소 footprint(가능하면 기존 UI 컴포넌트로)

**Guardrails**
- derived metric 계산 금지(비율/증감률 생성 금지)
- backend 변경 금지

**Acceptance Criteria**
- stats 성공 → 차트 표시
- stats 실패 → 에러 패널 + retry, requestId 노출
- 성능/번들 급증 없음(상대적)

---

### (Optional) M3 — Bulk Cancel Observability Polish
Sprint 18 후반에 여유가 있으면만.
- requestId copy
- status badge 통일
- deep-link 복사(현재 URL 그대로)

---

## 5) Endpoint / Page Audit 체크리스트 (Sprint 18 시작 시 1시간 내)

M1 착수 전 “있는 것만” 정확히 확인:
- Admin에 이미 존재하는 리스트 페이지:
  - `/instructors` ✅
  - `/programs` ✅ (bulk-cancel 선택에 사용)
  - `/bulk-cancel` ✅
  - `/reservations` ? (없으면 drill-down 대상 제외)
  - `/users` ? (없으면 drill-down 대상 제외)
- Admin API에 이미 존재하는 endpoint:
  - `GET /admin/programs` ✅
  - `GET /admin/instructors` ✅
  - (기타 리스트 endpoint는 존재 여부 확인)

> 결과에 따라 Drill-down 매핑 표를 “SSOT 업데이트”로 고정한다.

---

## 6) 주요 리스크 & 완화

- **URL state coupling 확장** (Medium)  
  → 기존 bulk-cancel 패턴 재사용, 파라미터 명확히 표준화(예: page, limit/search/filter)

- **useSearchParams identity loop** (Low~Medium)  
  → Sprint 17에서 사용한 `initializedFromUrl` 가드 패턴 유지

- **차트 도입으로 번들 증가** (Medium)  
  → 가능하면 최소 구현(단순 SVG/HTML), 라이브러리 도입은 마지막

- **전역 리팩토링 유혹** (Low)  
  → “중복 허용” 원칙을 명시적으로 유지

---

## 7) Out of Scope (명시적 제외)
- Backend 변경 / 신규 endpoint / DTO 변경
- Metrics 캐싱 레이어
- Analytics aggregation 개선
- Global list abstraction / unified pagination component 대규모 리팩토링
- Drill-down을 위한 “새로운” 데이터 집계/계산

---

## 8) PR / 리뷰 기준
- 변경 범위는 `apps/admin` 중심
- Contract 문서(이 SSOT)와 구현이 불일치하면 PR reject
- 에러 패널은 항상 `message/code/requestId` 노출
- Retry는 동일 요청(파라미터 포함) 재발행

---

## 9) status.md 업데이트 지침 (반드시)
`status.md`에서 아래 2곳만 업데이트(구조 변경 금지):
1) Sprint 17 행(이미 완료 표기라면 유지)  
2) “다음 단계” 섹션 문구를 Sprint 18 목표로 교체

권장 문구:
- Sprint 테이블(확정):
  `| Sprint 17 | Admin Pagination Completion + Dashboard Stats (Read-only) | COMPLETED |`
- Next step:
  `- **Sprint 18**: Dashboard Drill-down + Metrics Expansion (Read-only)`

---

## 10) Definition of Done (Sprint 18)
- M1 + M2 완료(또는 M2 일부)  
- URL authoritative + server-side pagination + unified error envelope 준수
- `pnpm lint` / `pnpm test` / `tsc --noEmit` 통과 (repo 정책에 따름)
