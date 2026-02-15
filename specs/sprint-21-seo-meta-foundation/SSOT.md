# Sprint 21 SSOT — M1 SEO Meta Foundation (apps/web)

> 목적: **/instructors/[slug]** 페이지에 SEO 메타(Title/Description/OG/Canonical)를 **동적으로** 구현한다.  
> 범위: **apps/web only**. 백엔드/DB/예약 모듈 변경 금지. 기존 리다이렉트/APPROVED 로직 유지.

---

## 0) Facts vs Assumptions

### Facts (사용자 제공)
- Sprint 21 M1 시작: **SEO Meta Foundation**
- 대상: `apps/web`의 `/instructors/[slug]`
- 구현: **dynamic title, meta description, OpenGraph, canonical URL**
- 금지: **backend changes 없음**, **database changes 없음**
- 제약: **기존 redirect behavior 유지**, **reservation modules 수정 금지**, **APPROVED instructor 로직 변경 금지**
- 진행: **implementation plan 먼저 작성 후 진행**

### Assumptions (레포 상태 미확인이라 가정)
- Next.js App Router 기반이며 `/instructors/[slug]/page.tsx`가 존재한다.
- 기존 데이터 로딩/redirect/APPROVED 체크가 `page.tsx` 또는 인접 파일에서 수행된다.
- `status.md`는 스프린트/CP 진행 현황을 기록한다(형식은 기존 스프린트와 유사).

> **주의:** 아래 설계는 *레포 구조가 다를 수 있음*. Claude Code는 실제 파일 구조를 읽고 경로/함수명을 맞춰 수정한다.

---

## 1) Scope / Non-goals

### In Scope
- `/instructors/[slug]` 페이지에 **Next.js metadata**(또는 head)로:
  - `title`
  - `description`
  - `openGraph`(title/description/url/images 등 가능한 범위)
  - `alternates.canonical`
  - (가능하면) `robots` (APPROVED가 아닐 때 index 방지 필요 여부는 “기존 동작”을 따름)

### Out of Scope (명시적 금지)
- 서버 앱(예: `apps/server`) 변경
- Prisma/DB 스키마/마이그레이션 변경
- 예약 관련 모듈(Reservation modules) 수정
- APPROVED 판정 규칙/리다이렉트 규칙 변경

---

## 2) Success Metrics / Acceptance Criteria

### A. SEO 메타 동작 (필수)
1. `/instructors/[slug]` 접근 시 **slug별로 title/description이 달라진다.**
2. 페이지 HTML에 **canonical URL**이 올바르게 렌더링된다.
3. OpenGraph 메타가 렌더링된다:
   - `og:title`, `og:description`, `og:url`(가능하면)
4. 기존 redirect behavior가 **동일하게 유지**된다:
   - instructor 미존재/비승인 등 기존 조건에서 **동일한 redirect/404 처리**
5. APPROVED 로직이 **변경되지 않는다**(조건/필터/상태값 등).

### B. 품질 (권장)
6. 메타 구성은 **서버 렌더링 시점에 결정**되어 크롤러가 읽을 수 있다(Next metadata 권장).
7. 불필요한 추가 fetch/중복 쿼리를 최소화한다(가능하면 데이터 fetch 재사용).

---

## 3) Implementation Plan (우선 계획)

### 3.1 접근 전략 (권장)
- App Router의 `generateMetadata()`를 **`/instructors/[slug]/page.tsx`**(또는 해당 라우트의 `layout.tsx`)에 구현한다.
- `generateMetadata()` 내부에서 **기존 데이터 로딩 함수/쿼리**를 호출하되,
  - **APPROVED/redirect 판정**은 *기존 page 렌더링 로직과 동일한 규칙*을 사용한다.
  - 단, metadata 단계에서 redirect를 직접 트리거하면 동작이 달라질 수 있으므로:
    - **metadata에서는 “안전한 기본 메타”**를 반환하고,
    - 실제 redirect/404는 **기존 page 로직이 수행**하도록 유지하는 방식을 우선 고려한다.
- 단, 현재 구현이 metadata 단계에서도 동일하게 처리해야 한다면(예: notFound/redirect가 metadata에서 이미 발생):
  - 기존 동작을 깨지 않도록 **현재 라우트 동작을 기준으로** 맞춘다.

> 선택 기준:
> - **기존 동작을 유지**하는 것이 1순위.
> - 메타 정확도 vs redirect 변경 위험이 충돌하면, **redirect 보존**이 우선.

### 3.2 메타 구성 규칙
- **Title**
  - 기본: `{instructor.displayName} | 숲똑` (브랜드명은 레포 기존 규칙 확인)
  - fallback: `강사 소개 | 숲똑` (instructor가 없거나 데이터 부족)
- **Description**
  - 후보 우선순위(존재하는 필드 기준):
    1) `instructor.bio` / `introduction` / `summary`
    2) `instructor.shortDescription`
    3) fallback: `숲체험 강사 소개 페이지입니다.`
  - 길이: 140~160자 선호(자동 truncate 가능)
- **OpenGraph**
  - `openGraph.title`, `openGraph.description`, `openGraph.url`
  - `openGraph.type`: `profile` 또는 `website` (문서화된 값 중 선택)
  - `openGraph.images`: 가능한 경우 대표 이미지 1장
- **Canonical**
  - 절대 URL 권장: `https://<DOMAIN>/instructors/<slug>`
  - 도메인 소스:
    - 우선: `process.env.NEXT_PUBLIC_SITE_URL` 또는 유사 환경 변수
    - 없으면: 상대 canonical(가능하나 덜 권장) 또는 런타임 헤더 기반 구성(Next `headers()`/`NEXT_URL` 등)
  - **절대 URL이 불가하면**, 최소한 경로 기반으로라도 일관되게.

### 3.3 데이터 재사용(중복 fetch 줄이기)
- page와 metadata가 같은 데이터를 필요로 할 경우:
  - 공통 함수 `getInstructorBySlug(slug)`를 라우트 파일 내 또는 `lib`로 추출
  - Next의 fetch caching(React cache / `cache()` / `unstable_cache`)를 사용해 같은 요청 내 중복 호출 최소화
  - 단, 캐싱 변경이 동작/권한/최신성에 영향을 주지 않도록 주의

---

## 4) Task Breakdown (Checklist)

### CP1 — 메타 기초 구현
- [ ] `/instructors/[slug]`에서 `generateMetadata({ params })` 추가
- [ ] title/description 동적 생성
- [ ] openGraph 동적 생성
- [ ] canonical 추가 (`alternates: { canonical }`)
- [ ] fallback 메타 정의

### CP2 — 기존 동작 보존
- [ ] 기존 redirect 로직 경로/조건 파악
- [ ] redirect behavior가 바뀌지 않도록 구현(특히 metadata 단계에서 redirect 유발 금지)
- [ ] APPROVED 로직 변경 없음 확인(조건식/상수/필터 그대로)

### CP3 — 테스트/검증
- [ ] 로컬에서 3 케이스 확인
  1) 정상 APPROVED instructor slug
  2) 미존재 slug
  3) 비승인/차단 slug(레포에 해당 상태가 있다면)
- [ ] HTML 소스에서 메타 태그 확인(SSR 결과)
- [ ] (있다면) Playwright/E2E 또는 Next 테스트 추가는 선택(토큰/시간 아끼려면 수동 검증 체크리스트로 대체)

### CP4 — 문서/상태 업데이트
- [ ] `status.md`에 Sprint 21 / CP 진행 업데이트(레포 형식 준수)
- [ ] 스프린트 산출물: 본 SSOT md 포함(필요 시 `specs/sprint-21-seo-meta-foundation/SSOT.md` 형태)

---

## 5) File Touch Plan (예상)

> 실제 경로는 Claude Code가 레포에서 확인 후 조정.

- `apps/web/src/app/instructors/[slug]/page.tsx`
  - `generateMetadata` 추가 또는 `layout.tsx`로 이동
  - 기존 데이터 로딩 함수 호출 (재사용)
- (옵션) `apps/web/src/lib/seo.ts` 또는 `apps/web/src/lib/metadata.ts`
  - 메타 생성 유틸(문자 truncate, canonical 빌드 등)
- (옵션) `apps/web/next.config.*` / 환경변수 문서
  - `NEXT_PUBLIC_SITE_URL` 존재 여부 확인(추가가 필요하면 *환경변수만* 추가하고 코드에서 optional 처리)
- `status.md` (루트 또는 specs 폴더)
  - Sprint 21 진행 업데이트

---

## 6) Verification Checklist (실행 가능한 검증)

### Case 1: APPROVED instructor
- URL: `/instructors/<valid-slug>`
- 기대:
  - `<title>`에 강사명이 포함
  - `meta[name="description"]` 존재
  - `meta[property="og:title"]`, `og:description`, `og:url` 존재
  - `link[rel="canonical"]` 존재, URL이 올바름

### Case 2: Not found
- URL: `/instructors/<non-existent>`
- 기대:
  - 기존과 동일한 redirect/404
  - 메타가 잘못된 강사명으로 노출되지 않음(기본 메타 또는 notFound 처리)

### Case 3: Not approved (해당 상태가 있을 때)
- URL: `/instructors/<not-approved>`
- 기대:
  - 기존과 동일한 redirect/차단 처리
  - APPROVED 체크 조건 동일

---

## 7) Risks & Gaps

- **리스크 1: metadata 단계에서 redirect/notFound 발생 → 기존 동작 변화**
  - 대응: metadata에서는 안전한 fallback을 반환하고, redirect는 기존 page 로직에 맡기기
- **리스크 2: canonical의 도메인 결정 실패**
  - 대응: `NEXT_PUBLIC_SITE_URL` 있으면 사용, 없으면 상대 canonical 또는 헤더 기반 구성
- **리스크 3: 중복 fetch로 성능 저하**
  - 대응: 공통 getter + cache 도입(동작 영향 최소 범위에서)
- **갭: status.md 형식 미확인**
  - 대응: Claude Code가 파일을 열어 기존 포맷 그대로 Sprint 21 항목을 추가/수정

---

## 8) Extensions (Sprint 21 이후/추가 가치)

- 구조화 데이터(JSON-LD: Person/Organization) 추가
- OG 이미지 동적 생성(강사 프로필 기반)
- sitemap에 instructor pages 포함(단, 백엔드/인덱싱 정책과 연동 필요)
- robots 정책 정교화(미승인 페이지 noindex 등)

---

## 9) Claude Code 실행 명령문 (토큰 절약 버전)

아래를 Claude Code에 그대로 붙여넣기:

1) 이 SSOT 파일을 읽고 **계획→구현→검증** 순서로 진행  
2) 변경 범위/제약 준수 체크리스트를 마지막에 출력

