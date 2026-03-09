# 관리자 사이트 개선/리팩토링 계획

## 현황 분석

현재 `apps/admin`은 12개 페이지가 구현된 기능적 MVP 상태이나, 코드 품질·일관성·유지보수성에 개선이 필요합니다.

### 식별된 핵심 문제

| 우선순위 | 문제 | 영향 |
|----------|------|------|
| **P0** | AuthContext에 하드코딩된 dev 인증 우회 | 보안 취약점 — 모든 인증 무력화 |
| **P1** | 대부분 페이지에 에러 처리 없음 (users, reviews, settlements, providers, programs) | API 실패 시 무반응, UX 저하 |
| **P1** | 목록+필터+페이지네이션 패턴이 모든 페이지에 중복 구현 | 유지보수 어려움, 일관성 부재 |
| **P2** | 상태 뱃지 렌더링 6곳 중복 | 스타일 불일치 위험 |
| **P2** | 모달이 각 페이지에 인라인 구현 (공유 컴포넌트 없음) | 코드 중복, 접근성 미지원 |
| **P2** | BulkCancelClient.tsx 815줄 단일 파일 | 가독성·테스트 어려움 |
| **P2** | TypeScript 타입 안전성 부족 (unknown, 매직 스트링) | 런타임 에러 위험 |
| **P3** | URL 상태 동기화 bulk-cancel만 적용 | 새로고침 시 필터/페이지 유실 |
| **P3** | 테스트 커버리지 (api.test.ts 1개만 존재) | 리그레션 위험 |
| **P3** | 접근성 미지원 (label, ARIA, focus trap 없음) | 웹 접근성 기준 미달 |

---

## 리팩토링 단계 (6단계)

### Phase 1 — P0 보안 수정 + 공유 타입 정의
> 예상 변경 파일: 3개

1. **AuthContext.tsx dev 우회 제거** — 하드코딩된 `setUser({ id: 'dev' ... })` 블록 삭제, 정상 localStorage 복원 로직만 유지
2. **`src/types/admin.ts` 신규** — 백엔드 응답 타입 정의
   - 페이지네이션 응답: `PaginatedResponse<T> { items: T[]; total: number; page: number; totalPages: number }`
   - 각 엔티티 타입: `AdminUser`, `AdminInstructor`, `AdminProgram`, `AdminReview`, `AdminSettlement`, `AdminProvider`
   - 상태 enum: `InstructorStatus`, `ApprovalStatus`, `ReviewStatus`, `SettlementStatus` 등 (매직 스트링 제거)
3. **`src/types/api.ts` 신규** — `DashboardStats`, `ErrorState` 등 공통 API 타입

### Phase 2 — 공유 커스텀 훅 추출
> 예상 변경 파일: 2개 신규

1. **`src/hooks/useListData.ts`** — 목록 데이터 페칭 커스텀 훅
   - 입력: endpoint, filters, page, limit
   - 출력: `{ data, loading, error, reload, setPage, setFilters }`
   - 자동 URLSearchParams 구성, ApiError 처리, 로딩 상태 관리
   - 모든 목록 페이지(users, instructors, reviews, settlements, providers, programs)에서 사용
2. **`src/hooks/useApiAction.ts`** — 단발성 API 호출(승인/거절/상태변경) 커스텀 훅
   - 입력: action callback
   - 출력: `{ execute, loading, error }`
   - 중복 클릭 방지, 에러 처리, 성공 후 콜백

### Phase 3 — 공유 UI 컴포넌트 추출
> 예상 변경 파일: 5개 신규

1. **`src/components/StatusBadge.tsx`** — 상태별 색상·라벨 매핑 통합 컴포넌트
   - props: `status: string`, `variant: 'instructor' | 'approval' | 'review' | 'settlement'`
2. **`src/components/Modal.tsx`** — 공유 모달 컴포넌트
   - 배경 클릭 닫기, ESC 키 닫기, focus trap, ARIA 속성
3. **`src/components/ErrorPanel.tsx`** — 에러 표시 + 재시도 버튼 컴포넌트
   - props: `error: ErrorState`, `onRetry?: () => void`
4. **`src/components/DataTable.tsx`** — 테이블 래퍼 (선택적)
   - 헤더 정의, 로딩 스켈레톤, 빈 상태 메시지
5. **`src/components/SearchFilter.tsx`** — 검색 + 필터 드롭다운 조합 컴포넌트
   - 디바운스 검색, 필터 옵션 props

### Phase 4 — 페이지 리팩토링 (커스텀 훅 + 공유 컴포넌트 적용)
> 예상 변경 파일: 8개 수정

각 페이지를 순서대로 리팩토링:
1. `/users/page.tsx` — `useListData` 적용 + ErrorPanel + StatusBadge
2. `/reviews/page.tsx` — 동일 패턴
3. `/settlements/page.tsx` — 동일 패턴
4. `/providers/page.tsx` — 동일 패턴 (pageSize 파라미터명 차이 처리)
5. `/programs/pending/page.tsx` — 동일 패턴
6. `/instructors/page.tsx` — 동일 패턴 + 탭 필터 유지
7. `/instructors/[id]/page.tsx` — Modal 컴포넌트 적용 + ErrorPanel
8. `/page.tsx` (대시보드) — ErrorPanel 적용

### Phase 5 — BulkCancelClient 분리
> 예상 변경 파일: 5개 (1개 수정 + 4개 신규)

`BulkCancelClient.tsx` (815줄)를 단계별 컴포넌트로 분리:
1. **`src/app/bulk-cancel/components/ProgramSelector.tsx`** — 프로그램 선택 단계
2. **`src/app/bulk-cancel/components/DryRunPreview.tsx`** — 미리보기 단계
3. **`src/app/bulk-cancel/components/ExecutionConfirm.tsx`** — 실행 확인 모달 + 결과
4. **`src/app/bulk-cancel/components/JobResult.tsx`** — 작업 결과 + 항목 페이지네이션
5. **`BulkCancelClient.tsx`** → 상태 머신 + 단계 전환만 담당 (200줄 이하 목표)

### Phase 6 — URL 상태 동기화 + 테스트
> 예상 변경 파일: 4-6개

1. **`src/hooks/useUrlState.ts`** — URL searchParams ↔ 컴포넌트 상태 동기화 훅
   - `useListData`와 통합하여 모든 목록 페이지에 필터/페이지 북마크 지원
2. **주요 컴포넌트 테스트 추가**
   - `StatusBadge.test.tsx`, `ErrorPanel.test.tsx`, `Modal.test.tsx`
   - `useListData.test.ts`, `useApiAction.test.ts`

---

## 리팩토링 원칙

- **기능 변경 없음** — 외부 동작은 현재와 동일하게 유지
- **백엔드 변경 없음** — 프론트엔드 코드만 수정
- **점진적 적용** — 각 Phase가 독립적으로 배포 가능
- **Phase 1(보안)은 즉시 적용** — 나머지는 순서대로 진행
