# SPEC Sprint 9 — Category & Discovery Layer (Mobile-Friendly Revision)
SSOT (Single Source of Truth). 구현·리뷰·테스트는 본 문서를 기준으로 한다.

---

## 0. Context
- Monorepo: Turborepo + pnpm
- Backend: NestJS (`apps/server`)
- Admin FE: Next.js (`apps/admin`)
- Mobile: React Native
- DB: Prisma
- Sprint 5~8 완료 (Admin / Reviews / BulkCancel / Hardening)
- 목표: PC 기준 백엔드이지만 모바일에서도 UX가 자연스러운 탐색 구조 제공

---

## 1. Decisions / Defaults (모호하면 이 섹션을 따른다)
- 카테고리는 다대다(Program ↔ Category)
- 카테고리는 단일 레벨 (계층 구조 없음)
- Program은 0개 이상 카테고리 가능 (권장: 최소 1개)
- 검색은 기본 LIKE 기반 (Full-text는 Sprint 10 이후)
- region 필터는 기존 regionTags 사용
- 정렬 기본값: 최신순(createdAt desc)
- ratingAvg/reviewCount 정렬을 위해 Program에 `ratingAvg`(Float), `reviewCount`(Int) **denormalized 필드**를 둔다 (리뷰 생성/상태 변경 시 갱신)
- 리스트 응답의 `ratingAvg`, `reviewCount`는 Program의 denormalized 필드를 사용한다 (aggregate join 금지: Sprint 10 이후 재검토)
- 모든 에러는 BusinessException(code) 규약 준수

---

## 2. Goals
- Category 모델 추가
- ProgramCategory join table 구현
- 모바일 카드 UI에 바로 사용 가능한 Program 조회 API 설계
- 카테고리 기반/키워드 기반 필터
- Admin Category CRUD

---

## 3. Domain Model

### 3.1 Category
- id (uuid, PK)
- name (string, unique)
- slug (string, unique)
- createdAt
- updatedAt

### 3.2 ProgramCategory (Join Table)
- programId (FK)
- categoryId (FK)
- UNIQUE(programId, categoryId)

---

## 4. API Contract

### 4.1 Public — Get Programs (Card-Friendly)

#### GET /programs

Query Params:
- category?: string (slug)
- keyword?: string (min 2 chars, trim 처리)
- region?: string
- sort?: "latest" | "rating" | "priceAsc" | "priceDesc"
- page?: number (default 1)
- pageSize?: number (default 20)

Rules:
- keyword는 trim 후 2글자 미만이면 400 (code: VALIDATION_ERROR)
- category slug 존재하지 않으면 404 (code: CATEGORY_NOT_FOUND)
- status=VISIBLE 프로그램만 노출

Response 200:
{
  "items": [
    {
      "id": "uuid",
      "title": "숲속 곤충 탐험",
      "coverImageUrl": "https://...",
      "regionTags": ["chuncheon"],
      "categories": [
        { "slug": "forest", "name": "숲체험" }
      ],
      "minPrice": 30000,
      "scheduleAt": "2026-05-01T10:00:00Z",
      "ratingAvg": 4.5,
      "reviewCount": 23
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 123
}

---

### 4.2 Public — Get Categories

#### GET /categories

Response 200:
{
  "items": [
    {
      "id": "uuid",
      "name": "숲체험",
      "slug": "forest",
      "programCount": 42
    }
  ]
}

---

### 4.3 Admin — Category CRUD

#### POST /admin/categories
Req:
{
  "name": "숲체험",
  "slug": "forest"
}

Error:
- slug 중복 → 409 (code: CATEGORY_SLUG_CONFLICT)

#### PATCH /admin/categories/:id
Req:
{
  "name"?: string,
  "slug"?: string
}

#### DELETE /admin/categories/:id

Rules:
- 연결된 ProgramCategory는 cascade 또는 명시 삭제
- 존재하지 않는 id → 404 (code: CATEGORY_NOT_FOUND)

---

## 5. Sorting Rules

### 5.1 Implementation Notes (Performance)
- `ratingAvg`, `reviewCount`는 Program 테이블의 denormalized 필드를 기준으로 정렬한다.
- 리뷰 생성/수정/숨김 처리 시 Program의 `ratingAvg`, `reviewCount`를 트랜잭션으로 갱신한다.
- `GET /programs` 리스트에서는 Review 테이블 aggregate join을 수행하지 않는다.


- latest → createdAt desc
- rating → ratingAvg desc
- priceAsc → minPrice asc
- priceDesc → minPrice desc

---

## 6. Acceptance Criteria

- AC-1: 카테고리 생성 후 Program 연결 가능
- AC-2: GET /programs?category=forest 정상 필터
- AC-3: GET /programs?keyword=곤충 검색 동작
- AC-4: region + category + keyword 조합 필터 가능
- AC-5: reviewCount 및 ratingAvg는 Program denormalized 필드 기준으로 정확(리뷰 숨김 포함 반영)
- AC-6: slug 중복 시 CATEGORY_SLUG_CONFLICT 반환
- AC-7: keyword 1글자 시 VALIDATION_ERROR 반환

---

## 7. Non-Goals
- 계층형 카테고리
- Full-text search 엔진
- 추천 알고리즘
- 개인화 추천

---

## 8. Deliverables Checklist
- [ ] Category 모델 + migration
- [ ] ProgramCategory join table + migration
- [ ] Program에 ratingAvg(Float), reviewCount(Int) 필드 추가 + migration (기본값 0)
- [ ] Reviews/BulkCancel/Admin hide 로직에서 Program denormalized 필드 갱신
- [ ] GET /programs 필터/정렬 구현
- [ ] GET /categories (programCount 포함)
- [ ] Admin Category CRUD
- [ ] BusinessException(code) 적용
- [ ] 회귀 테스트 통과

---

## 9. Verification (Definition of Done)
- pnpm test:all PASS
- pnpm typecheck:all PASS
- pnpm build:all PASS
- 모바일 카드 UI에서 별도 가공 없이 사용 가능
