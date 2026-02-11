
# SPEC Sprint 5 — Admin FE (Next.js) + Provider Mini-Home (Admin Proxy Editing)
SSOT (Single Source of Truth). 구현·리뷰·테스트는 **본 문서만**을 기준으로 한다.

---

## 0. Context
- Monorepo: Turborepo + pnpm
- Backend: NestJS (`apps/api`)
- Mobile: React Native (Sprint 5 범위 아님)
- Admin FE: Next.js (`apps/admin`)
- Auth: Kakao OAuth only
- Status: Phase 0~4 백엔드 완료, Sprint 5에서 Admin FE + Provider 미니홈(어드민 대리편집) 추가

---

## 1. Decisions / Defaults (모호하면 무조건 이 섹션을 따른다)
- Admin 접근은 `role=ADMIN`만 허용
- Provider 1개당 ProviderProfile 1개 (1:1)
- Sprint 5에서는 **어드민 대리 편집만 제공** (업체/강사 셀프 편집 ❌)
- 미니홈은 **고정 템플릿** (CMS/페이지빌더/커스텀 CSS ❌)
- Cover 이미지 최대 3장, S3 presigned upload 사용
- `isPublished=true` 인 경우만 Public 노출 (미게시 시 404)
- 리뷰 / 우천취소 / 카테고리 / Provider 멤버 관리 → Sprint 5 범위 아님

---

## 2. Goals
- 실운영 가능한 최소 Admin UI 제공
- 프로그램 승인 / 정산 / 유저 role 변경 / Provider 및 미니홈 관리 UI 완성
- API 계약·권한·검증을 고정하여 **리팩터링 없는 확장 기반** 확보

---

## 3. Scope
### 3.1 Admin FE
- Admin 로그인(Kakao) + 권한 게이트
- Dashboard (최소 KPI)
- Program 승인 / 거절
- Settlement 조회 / 지급 처리
- User 조회 및 role 변경 (PARENT ↔ INSTRUCTOR)
- Provider CRUD
- ProviderProfile 대리 편집 + 게시 / 비게시

### 3.2 Backend
- Admin Provider / ProviderProfile CRUD
- Presigned upload 발급
- Public ProviderProfile 게시 게이팅

---

## 4. Non-Goals
- Provider 멤버 초대 / 권한 관리
- 강사·업체 셀프 프로필 편집
- 템플릿 선택 / 레이아웃 커스터마이징
- SEO / 외부 도메인
- 리뷰 시스템
- 우천 일괄 취소
- 카테고리 체계

---

## 5. Domain Model (Canonical)

### 5.1 Provider
- id (uuid, PK)
- name (string, 1~80)
- regionTags (string[])
- createdAt, updatedAt

### 5.2 ProviderProfile
- id (uuid, PK)
- providerId (uuid, UNIQUE FK)
- displayName (string, default provider.name)
- introShort (string, ≤40)
- certificationsText (text)
- storyText (text)
- coverImageUrls (string[], ≤3)
- contactLinks ({ type, url }[], ≤3)
- isPublished (boolean, default false)
- createdAt, updatedAt

---

## 6. Permissions & Security
- 모든 `/admin/*` 엔드포인트는 ADMIN만 접근
- 미인증: 401 / 인증됐으나 ADMIN 아님: 403
- Public ProviderProfile은 게시 상태만 노출

---

## 7. API Contract (SSOT)

### 7.1 Pagination (공통)
- page (1-based, default 1)
- pageSize (default 20, max 100)
- response: `{ items, page, pageSize, total }`

### 7.2 Admin: Providers

#### POST /admin/providers
Auth: ADMIN

Req:
```json
{ "name": "string", "regionTags": ["string"] }
```

Res: 201
```json
{ "id":"uuid","name":"string","regionTags":["string"],"createdAt":"ISO","updatedAt":"ISO" }
```

Errors:
- 400 validation error

#### GET /admin/providers
Auth: ADMIN

Query:
- query (optional)
- page, pageSize

Res: 200
```json
{ "items":[Provider],"page":1,"pageSize":20,"total":123 }
```

#### PATCH /admin/providers/:id
Auth: ADMIN

Req:
```json
{ "name":"string?", "regionTags":["string"]? }
```

Res: 200
```json
{ "id":"uuid","name":"string","regionTags":["string"],"createdAt":"ISO","updatedAt":"ISO" }
```

Errors:
- 400 validation error
- 404 provider not found

---

### 7.3 Admin: ProviderProfile

#### GET /admin/providers/:id/profile
Auth: ADMIN

Decision (Fixed):
- Provider는 존재하나 Profile이 없으면 **200 + default payload 반환**

Res: 200
```json
{
  "providerId":"uuid",
  "displayName":"string",
  "introShort":"",
  "certificationsText":"",
  "storyText":"",
  "coverImageUrls":[],
  "contactLinks":[],
  "isPublished":false,
  "createdAt":"ISO",
  "updatedAt":"ISO"
}
```

Errors:
- 404 provider not found

#### PUT /admin/providers/:id/profile
Auth: ADMIN

Req:
```json
{
  "displayName":"string",
  "introShort":"string",
  "certificationsText":"string",
  "storyText":"string",
  "coverImageUrls":["string"],
  "contactLinks":[{"type":"instagram","url":"https://..."}]
}
```

Rules:
- introShort ≤ 40
- coverImageUrls.length ≤ 3
- contactLinks.length ≤ 3

Res: 200
```json
{ "providerId":"uuid","isPublished":false,"updatedAt":"ISO" }
```

Errors:
- 400 validation error
- 404 provider not found

#### POST /admin/providers/:id/profile/cover-images/presign
Auth: ADMIN

Req:
```json
{
  "files":[
    {"filename":"a.jpg","contentType":"image/jpeg"},
    {"filename":"b.webp","contentType":"image/webp"}
  ]
}
```

Rules:
- contentType must be image/*
- (existing coverImageUrls + files.length) ≤ 3

Res: 200
```json
{
  "uploads":[
    {
      "uploadUrl":"https://presigned...",
      "method":"PUT",
      "headers":{"Content-Type":"image/jpeg"},
      "finalUrl":"https://cdn-or-s3/.../a.jpg"
    }
  ]
}
```

Errors:
- 400 validation error
- 404 provider not found

#### PATCH /admin/providers/:id/profile/publish
Auth: ADMIN

Req:
```json
{ "isPublished": true }
```

Res: 200
```json
{ "providerId":"uuid","isPublished":true,"updatedAt":"ISO" }
```

---

### 7.4 Public: ProviderProfile

#### GET /providers/:id/profile
Auth: Public

Res: 200
```json
{
  "provider":{"id":"uuid","name":"string","regionTags":["string"]},
  "profile":{"displayName":"string","introShort":"string","coverImageUrls":["string"],"isPublished":true}
}
```

Errors:
- 404 provider not found
- 404 profile not published

---

## 8. Admin FE Information Architecture
Routes:
- /login
- /
- /programs/pending
- /settlements
- /users
- /providers
- /providers/[id]/profile

---

## 9. Admin FE Screen Specs
- Dashboard: 승인대기 프로그램 수 / 정산 대기 수
- Providers: 목록, 생성, 수정, 미니홈 편집
- Profile Editor: 좌측 폼 / 우측 미리보기

---

## 10. Acceptance Criteria
- ADMIN만 admin 접근 가능
- Provider 생성/수정 가능
- Profile 미게시 상태 public 404
- 게시 후 public 200

---

## 11. Testing (Minimum)
- Admin guard test
- Profile validation test
- Publish gating test

---

## 12. Implementation Notes
- 기존 NestJS guard/dto/service 패턴 재사용
- Presigned upload 기존 방식 유지
- 데이터 삭제 없음

---

## 13. Deliverables Checklist
- [ ] Provider / ProviderProfile migration
- [ ] Admin Provider API
- [ ] Admin ProviderProfile API
- [ ] Admin FE (apps/admin) 구현
- [ ] 최소 테스트 추가
- [ ] 실행/운영 문서 업데이트
