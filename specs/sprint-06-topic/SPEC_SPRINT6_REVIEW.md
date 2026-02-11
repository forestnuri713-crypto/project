
# SPEC Sprint 6 — Reviews (MVP)
SSOT (Single Source of Truth). 구현·리뷰·테스트는 본 문서를 기준으로 한다.

---

## 0. Context
- Monorepo: Turborepo + pnpm
- Backend: NestJS (`apps/api`)
- Admin FE: Next.js (`apps/admin`)
- Mobile: React Native
- Sprint 5(Admin + Provider) 완료 이후 단계
- 목적: 신뢰도 향상 + 품질 관리 기반 마련

---

## 1. Decisions / Defaults (모호하면 이 섹션을 따른다)
- 리뷰 작성 가능 조건: Reservation 상태가 COMPLETED 또는 ATTENDED일 때만
- 작성 주체: Parent 사용자만
- 리뷰 단위: Program 기준
- 1 Reservation 당 리뷰 1개 (UNIQUE 제약)
- 구성: rating(1~5) + comment(최대 300자)
- 수정: 작성 후 1회 수정 허용
- 삭제: 유저 삭제 불가, Admin만 HIDDEN 처리 가능
- Public 노출: status=VISIBLE인 리뷰만 노출

---

## 2. Goals
- Parent가 프로그램 참여 후 리뷰 작성 가능
- Program 상세 페이지에 리뷰 요약 표시
- Admin이 리뷰를 숨김 처리할 수 있음
- 리팩터링 없이 확장 가능한 구조 설계

---

## 3. Scope

### 3.1 Backend
- Review Entity 추가
- Review CRUD (Create / Read / Update 1회 제한)
- Admin hide/unhide 기능
- Program 평균 별점 계산 API

### 3.2 Frontend
- Parent: Program 상세에서 리뷰 작성 UI
- Admin: 리뷰 관리 페이지

---

## 4. Non-Goals
- 사진 리뷰
- 댓글/대댓글
- 좋아요 기능
- AI 요약
- 리뷰 신고 시스템

---

## 5. Domain Model (Canonical)

Review:
- id (uuid, PK)
- programId (uuid, FK)
- reservationId (uuid, UNIQUE FK)
- parentUserId (uuid, FK)
- rating (int, 1~5)
- comment (string, ≤300)
- status (VISIBLE | HIDDEN)
- createdAt
- updatedAt
- editedAt (nullable)

---

## 6. Permissions

Parent:
- 본인 reservation 기반으로만 리뷰 작성/수정 가능

Admin:
- 리뷰 숨김/해제 가능

Public:
- status=VISIBLE 리뷰만 조회 가능

---

## 7. API Contract

### POST /reviews
Auth: Parent

Req:
```json
{
  "reservationId": "uuid",
  "rating": 5,
  "comment": "좋은 체험이었습니다."
}
```

Rules:
- Reservation 상태가 COMPLETED 또는 ATTENDED
- rating 1~5
- comment ≤ 300자
- reservationId UNIQUE

Res: 201
```json
{
  "id": "uuid",
  "programId": "uuid",
  "rating": 5,
  "comment": "좋은 체험이었습니다.",
  "status": "VISIBLE",
  "createdAt": "ISO"
}
```

Errors:
- 400 validation error
- 403 not allowed
- 409 already reviewed

---

### PATCH /reviews/:id
Auth: Parent

Rules:
- 본인 리뷰만 수정 가능
- 수정 1회 제한

---

### GET /programs/:id/reviews
Auth: Public

Res: 200
```json
{
  "averageRating": 4.5,
  "totalCount": 12,
  "items": [
    {
      "rating": 5,
      "comment": "좋았어요",
      "createdAt": "ISO"
    }
  ]
}
```

---

### PATCH /admin/reviews/:id/hide
Auth: ADMIN

Req:
```json
{ "status": "HIDDEN" }
```

---

## 8. Admin FE

Route:
- /reviews

기능:
- 리뷰 목록 조회
- 필터 (program / rating / status)
- 숨김/해제 처리

---

## 9. Acceptance Criteria

- COMPLETED 예약만 리뷰 작성 가능
- Reservation 당 리뷰 1개 제한
- rating 범위 위반 시 400
- 숨김 처리 시 public 조회에서 제외
- 평균 별점 계산 정확

---

## 10. Testing

- UNIQUE(reservationId) 테스트
- 상태 게이팅 테스트
- hide 처리 후 public 미노출 테스트
- 평균 별점 계산 정확성 테스트

---

## 11. Implementation Notes

- 평균 별점은 DB aggregate 사용
- 소프트 삭제 대신 status 필드 사용
- 기존 권한 guard 패턴 재사용

---

## 12. Deliverables Checklist

- [ ] Review migration
- [ ] Review API 구현
- [ ] 평균 별점 계산 API
- [ ] Admin 리뷰 관리 UI
- [ ] Mobile 리뷰 작성 UI
- [ ] 최소 테스트 추가

---
