# 숲똑 (SoopTalk) — 프로젝트 현황

> 최종 업데이트: 2026-02-11
> 빌드 상태: `pnpm run build` 전체 성공 (shared, server, admin, mobile)
> 커밋: `8e89383` (main)

---

## 완료된 Phase 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 0 | 모노레포 초기 세팅 (Turborepo + pnpm) | 완료 |
| Phase 1 | Auth + 프로그램 + 예약 MVP | 완료 |
| Phase 2 | 결제 모듈 (PortOne) + 출석 체크 | 완료 |
| Phase 3 | 알림 자동화 (FCM/Cron) + 사진첩 (S3/sharp) | 완료 |
| Phase 4 | 정산 시스템 + 어드민 API | 완료 |
| Phase 5 | 어드민 대시보드 (프론트엔드) | **미착수** |

---

## Phase 4 이후 적용된 변경 사항

### 1. 인증 100% 카카오 로그인
- 로컬 회원가입/로그인 제거, `POST /auth/kakao` 단일 인증
- 첫 가입 시 `role` 선택 가능

### 2. 위치+시간 자동 출석 체크
- `POST /attendance/auto-checkin` — Haversine 거리(≤100m) + 시간 범위(±30분) 검증

### 3. 정산일 목요일로 변경
- `@Cron('0 2 * * 4')` — 매주 목요일 02:00

### 4. 알림 비용 선충전 캐시
- `messageCashBalance` 필드, 유료 알림 발송 전 잔액 차감, 부족 시 차단

### 5. 업체 미니홈페이지 (Provider Mini Homepage)
- `Provider`, `ProviderMember`, `ProviderProfile` 모델 신규
- 5개 엔드포인트: 프로필 upsert, 커버 이미지 presign, 공개 전환, 공개 조회, 멤버 목록

### 6. 강사 신청 + 신뢰 UI + 프로필 자동 구성 ← **최신**

아래에 상세 기술.

---

## 최신 작업: 강사 신청 + 신뢰 UI + 프로필 자동 구성

### 개요
업체 미니홈페이지 기본 API 위에 3가지를 추가:
1. **강사 가입 상태 관리** — APPLIED → APPROVED / REJECTED, 어드민 승인 후에만 프로그램 등록 가능
2. **신뢰 UI 요소** — 강사 자격/경력 뱃지(certifications), 프로그램별 안전 가이드/보험 여부
3. **프로필 프로그램/갤러리 자동 구성** — 기존 Program/Gallery를 소속 강사 instructor_id 기준으로 조회

### Shared 패키지 변경
| 파일 | 변경 |
|------|------|
| `types/user.ts` | `InstructorStatus` enum (NONE, APPLIED, APPROVED, REJECTED), `InstructorCertification` interface, User에 3개 필드 추가 |
| `types/program.ts` | `safetyGuide?`, `insuranceCovered` 추가 |
| `types/notification.ts` | `INSTRUCTOR_APPROVED`, `INSTRUCTOR_REJECTED` 추가 |
| `constants/index.ts` | `PROVIDER_GALLERY_PREVIEW_MAX_COUNT=20`, `INSTRUCTOR_CERTIFICATIONS_MAX_COUNT=10`, `PROGRAM_SAFETY_GUIDE_MAX_LENGTH=500` |
| `index.ts` | 새 타입/상수 re-export |

### Prisma 스키마 변경
- `InstructorStatus` enum 신규 (NONE, APPLIED, APPROVED, REJECTED)
- `NotificationType`에 `INSTRUCTOR_APPROVED`, `INSTRUCTOR_REJECTED` 추가
- `User` 모델: `instructorStatus` (default NONE), `instructorStatusReason?`, `certifications` (Json default [])
- `Program` 모델: `safetyGuide?`, `insuranceCovered` (default false)

### 마이그레이션
- 파일: `migrations/20260211000000_add_instructor_status_and_safety_fields/migration.sql`
- 기존 `role = 'INSTRUCTOR'` 사용자를 `instructor_status = 'APPROVED'`로 일괄 업데이트
- 적용 명령: `npx prisma migrate deploy`

### 신규/수정 API 엔드포인트 (5개 추가)

| Method | Endpoint | Auth | Role | 설명 |
|--------|----------|------|------|------|
| POST | `/auth/apply-instructor` | JWT | - | 강사 신청 (PARENT→INSTRUCTOR, status=APPLIED) |
| GET | `/admin/instructors` | JWT | ADMIN | 강사 신청 목록 (필터/페이지네이션) |
| PATCH | `/admin/instructors/:id/approve` | JWT | ADMIN | 강사 승인 + FCM 알림 |
| PATCH | `/admin/instructors/:id/reject` | JWT | ADMIN | 강사 거절 (사유 필수) + FCM 알림 |
| PATCH | `/admin/instructors/:id/certifications` | JWT | ADMIN | 인증 뱃지 수정 (최대 10개) |

### 기존 API 변경

| 엔드포인트 | 변경 |
|-----------|------|
| `POST /programs` | `instructorStatus !== 'APPROVED'`이면 403 Forbidden |
| `POST /auth/kakao` | role=INSTRUCTOR 가입 시 `instructorStatus=APPLIED` 자동 설정 |
| `GET /admin/dashboard/stats` | `pendingInstructors` 카운트 추가 |
| `GET /providers/:id/profile` | 프로그램/갤러리 자동 구성 + 멤버 뱃지 포함 |

### 변경 파일 목록 (20개)

**신규 (4개):**
- `apps/server/src/admin/dto/admin-query-instructors.dto.ts`
- `apps/server/src/admin/dto/reject-instructor.dto.ts`
- `apps/server/src/admin/dto/update-certifications.dto.ts`
- `apps/server/src/prisma/migrations/20260211000000_.../migration.sql`

**수정 (16개):**
- `packages/shared/src/types/user.ts`
- `packages/shared/src/types/program.ts`
- `packages/shared/src/types/notification.ts`
- `packages/shared/src/constants/index.ts`
- `packages/shared/src/index.ts`
- `apps/server/src/prisma/schema.prisma`
- `apps/server/src/auth/auth.service.ts`
- `apps/server/src/auth/auth.controller.ts`
- `apps/server/src/admin/admin.service.ts`
- `apps/server/src/admin/admin.controller.ts`
- `apps/server/src/programs/programs.service.ts`
- `apps/server/src/programs/dto/create-program.dto.ts`
- `apps/server/src/providers/providers.service.ts`
- `CONTEXT.txt`
- `PHASE2_TODO.txt`
- `status.md`

### 핵심 설계 결정

| 결정 | 이유 |
|------|------|
| InstructorStatus를 User에 직접 (별도 테이블 X) | 1:1 관계, 단순 상태 추적 |
| certifications → Json 컬럼 | 최대 10개 소규모 배열, 별도 테이블 불필요 |
| REJECTED 후 재신청 허용 | 서류 보완 후 재도전 UX |
| 프로필 프로그램은 OR 조건 (providerId OR memberInstructorId) | 기존 FK + 멤버 기반 자동 수집 모두 커버 |
| Gallery는 프로그램 기반 자동 조회 (최근 20개) | 별도 업로드 없이 기존 데이터 활용 |
| 기존 INSTRUCTOR → APPROVED 마이그레이션 | 기존 강사 차단 방지 |

---

## 전체 API 엔드포인트 (51개)

| 카테고리 | 개수 |
|----------|------|
| 인증 | 2 (kakao, apply-instructor) |
| 프로그램 | 5 |
| 예약 | 4 |
| 결제 | 2 |
| 출석 | 4 |
| 알림 | 4 |
| 사진첩 | 4 |
| 정산 (강사) | 1 |
| 어드민 | 17 (기존 13 + 강사 관리 4) |
| 업체 프로필 | 5 |
| 스케줄링 (Cron) | 2 |
| **합계** | **50 + Cron 2** |

---

## 다음 단계

- **Phase 5**: 어드민 대시보드 프론트엔드 (Next.js) — 미착수
- DB 마이그레이션 적용: `npx prisma migrate deploy` 필요
