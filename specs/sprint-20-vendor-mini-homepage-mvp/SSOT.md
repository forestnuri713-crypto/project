# Sprint 20 SSOT — Vendor Mini Homepage MVP (M1: Public Profile Page Skeleton)

> Project: **숲똑 (SoopTalk)**  
> Sprint: **20**  
> Document: **SSOT (Single Source of Truth)**  
> Date: **2026-02-15** (Asia/Seoul)  
> Status: **Planned → In Progress**  
>
> Context reference: `status.md` (Sprint 19 완료, Admin 관찰성 안정, 예약 시스템 불변)

---

## 0) Sprint 20 목표

### Objective
**M1 — Public Profile Page Skeleton**을 정확하고 고립된 형태로 구현한다.

- Public route: **`/instructors/[slug]`**
- **Read-only** instructor data 렌더링
- `isPublic` 가드: 비공개면 **404**
- slug 기반 라우팅
- 예약(Reservation)과의 통합 **절대 금지**
- 전역 리팩터링 금지
- 백엔드 계약(Contract) 안정 유지

### Sprint 20 Success Metrics
- `/instructors/:slug` 요청이 **정상 동작**(200/404)
- `isPublic=false` 또는 미존재 slug는 **404**
- 서버/어드민 빌드 및 테스트 **그대로 PASS** (기존 회귀 없음)

---

## 1) 범위 (Scope)

### In Scope (M1 only)
1. **Public Next.js Route** 추가  
   - `apps/web`(또는 Public FE 앱)에서 `app/instructors/[slug]/page.tsx` 구현
2. **읽기 전용 데이터 조회**
   - instructor에 대응되는 public profile payload를 fetch
3. **공개 여부 가드**
   - `isPublic === false` → Next.js `notFound()`
4. **기본 스켈레톤 UI**
   - 최소한의 섹션/레이아웃 (아래 "UI Skeleton" 참조)
5. **Observability 유지**
   - 기존 requestId / error-envelope 규약을 깨지 않는다(서버)

### Out of Scope (절대 금지)
- 예약 생성/취소/좌석/스케줄 연동 및 UI 노출
- 결제/출석/알림/사진첩/정산 연동
- Global refactor (공용 컴포넌트/라우팅 대개편 포함)
- 추가 CRUD(수정/업데이트/업로드 등) — M1은 **read-only**
- 검색/리스트/카테고리/추천(디스커버리) 연동
- SEO 고도화(OG/메타태그 자동화 등) — 최소만 허용(선택)

---

## 2) 배경/전제

- Sprint 19에서 **Admin visibility + observability**가 안정화됨.
- Sprint 20은 **Public Mini Homepage**의 최소 MVP 착수.
- “Backend changes must be minimal and isolated.”  
  즉, 새 기능이 필요하면 **새 엔드포인트 1개 수준** 또는 **기존 provider public 조회 활용**을 우선한다.
- “Reservation system must remain untouched.”  
  예약 서비스/테이블/로직/테스트 어떤 것도 수정하지 않는다.

---

## 3) 아키텍처 결정 (M1)

### FE App 위치 (가정)
- Public 웹 앱이 **`apps/web`**에 존재한다고 가정한다.
- 만약 Public 앱이 `apps/admin` 밖 다른 경로라면, 동일하게 Next.js App Router 구조로 적용.

### 라우팅
- **Route:** `GET /instructors/[slug]` (Next.js page route)
- slug는 **URL-safe** 문자열로 가정. (유효성은 서버에서 검증)

### 데이터 소스
M1에서는 **Instructor Public Profile**만 필요하다.

**우선순위**
1) 이미 존재하는 **public profile 조회 API**가 있으면 그것을 그대로 사용 (contract stable).
2) 없으면, 서버에 **새 read-only 엔드포인트 1개만 추가**:
   - `GET /public/instructors/:slug`
   - 반환 payload는 아래 계약을 따른다.
   - `isPublic=false`면 404로 응답(서버에서 선-가드) 또는 FE에서 notFound 처리.

---

## 4) API 계약 (Contract)

> 목표: FE 구현이 단일 payload로 충분하도록 최소한의 필드를 정의한다.  
> 단, 실제 DB 모델/테이블 구조는 SSOT에서 강제하지 않는다(백엔드 최소 변경 원칙).

### Endpoint (권장)
- **`GET /public/instructors/:slug`**

### Response — 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "slug": "string",
    "isPublic": true,
    "displayName": "string",
    "profileImageUrl": "string | null",
    "coverImageUrl": "string | null",
    "bio": "string | null",
    "certifications": [
      {
        "title": "string",
        "issuer": "string | null",
        "issuedAt": "string | null"
      }
    ],
    "provider": {
      "id": "uuid",
      "name": "string"
    } 
  }
}
```

### Response — 404 Not Found
- slug 미존재
- 또는 존재하지만 `isPublic=false`

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Not Found",
    "requestId": "req_xxx"
  }
}
```

### Error Envelope
- Sprint 15에서 확정된 error envelope를 **그대로 사용**한다.

---

## 5) UI Skeleton (M1)

> “Skeleton”은 기능이 아니라 **레이아웃과 읽기 전용 표시**만 의미한다.

### Page Sections
1. **Cover 영역**
   - `coverImageUrl` 있으면 배경 이미지
   - 없으면 placeholder
2. **Header**
   - 프로필 이미지(원형) + `displayName`
   - provider name(소속) 라벨
3. **Bio**
   - `bio` 텍스트(없으면 숨김)
4. **Certifications**
   - 최대 N개(서버 상수에 맞추되 M1은 단순 표시)
5. **Footer**
   - “Powered by SoopTalk” 정도의 정적 텍스트(선택)

### UX Rules
- 로딩 상태: 최소 skeleton/loader
- 404: Next.js `notFound()`로 표준 404 페이지
- 에러 노출: 개발 모드에서만 requestId 표시(선택)

---

## 6) 구현 계획 (Work Breakdown)

### A. Public Route 구현 (FE)
- [ ] `apps/web/src/app/instructors/[slug]/page.tsx` 생성
- [ ] server fetch 유틸(기존 `api`/`fetchJson` 있으면 재사용)
- [ ] 200 → 렌더
- [ ] 404 → `notFound()`
- [ ] 기타 에러(500 등) → 에러 boundary 또는 간단한 에러 UI

### B. Backend 최소 변경 (필요 시에만)
- [ ] `GET /public/instructors/:slug` 추가
- [ ] slug로 instructor 조회
- [ ] `isPublic` false면 404
- [ ] payload를 contract에 맞춰 매핑
- [ ] 기존 reservation 관련 코드/테스트 **미변경** 보장

### C. 테스트
- [ ] (서버) e2e 또는 service unit 최소 2개
  - slug 존재 & isPublic=true → 200 payload shape
  - slug 존재 & isPublic=false → 404
- [ ] (FE) smoke test
  - dev 서버에서 라우트 접근 및 notFound 확인

---

## 7) Acceptance Criteria (DoD)

**필수**
1. `/instructors/[slug]` 페이지가 존재한다.
2. slug가 유효하고 공개(`isPublic=true`)면 페이지가 렌더된다.
3. slug가 없거나 비공개면 404로 처리된다.
4. 예약 시스템(엔드포인트/서비스/DB/테스트) 변경이 없다.
5. 전역 리팩터링 없다.
6. `tsc --noEmit` PASS (server + admin + web)
7. 기존 jest 테스트 PASS (특히 reservation concurrency/consistency 관련)

---

## 8) 리스크 & 완화

### Risk: slug 충돌/정규화
- 완화: 서버에서 unique constraint 또는 조회 기준을 명확히(소문자 normalize 등).  
  M1에서는 **기존 규칙을 그대로 따르고**, 신규 규칙 도입은 금지.

### Risk: public profile 데이터가 provider/profile 모델과 분리됨
- 완화: M1은 contract에 필요한 최소 필드만 매핑.  
  추후 M2에서 provider mini homepage 확장 시 보강.

### Risk: 백엔드 변경이 커질 유혹
- 완화: “새 엔드포인트 1개 + read-only”를 원칙으로, DTO/서비스 구조 변경 금지.

---

## 9) 파일/경로 가이드 (권장)

### FE (Next.js App Router)
- `apps/web/src/app/instructors/[slug]/page.tsx`
- `apps/web/src/lib/api.ts` (기존 있으면 사용)
- `apps/web/src/components/instructor/PublicInstructorProfile.tsx` (선택)

### Server (NestJS)
- `apps/server/src/public/public.controller.ts` (신규 or 기존 public 컨트롤러)
- `apps/server/src/public/public.service.ts`
- `apps/server/src/public/dto/public-instructor.dto.ts` (선택)
- Prisma 조회는 기존 `PrismaService` 사용

---

## 10) 변경 제한(Guard Rails)

- **Reservation 모듈 코드/테스트/DB 스키마 변경 금지**
- **공용 패키지(shared) 대규모 수정 금지**
- 타입/상수 추가가 필요하면 **최소 단위**로만(그리고 FE에서만 가능한지 먼저 검토)
- “추가 기능” (갤러리/프로그램 목록 등)은 M2 이후로 이연

---

## 11) 커밋 규칙 (권장)
- FE: `feat(s20): add public instructor profile route skeleton`
- Server(필요 시): `feat(s20): add public instructor profile read endpoint`

---

## 12) 런/검증 명령
```bash
# server
cd apps/server
pnpm test
pnpm build

# web
cd apps/web
pnpm build

# admin regression (optional but recommended)
cd apps/admin
pnpm build
```

---

## Appendix A — M1 체크리스트 (복붙용)

- [ ] Route `/instructors/[slug]` 구현
- [ ] Read-only fetch + 렌더
- [ ] `isPublic` 404 gate
- [ ] No reservation touch
- [ ] No global refactor
- [ ] Build/tests pass
