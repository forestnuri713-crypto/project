# Phase 3: 알림 자동화 + 사진첩 고도화 — 완료

## 작업 요약

### Step 1: Shared 패키지 업데이트
- `packages/shared/src/types/notification.ts` 신규 — `NotificationType` enum (`PRE_ACTIVITY`, `GALLERY_UPLOADED`), `Notification` interface
- `packages/shared/src/types/gallery.ts` 수정 — `imageUrl` → `imageKey`, `thumbnailKey`/`uploadedBy` 추가
- `packages/shared/src/constants/index.ts` 수정 — `GALLERY_SIGNED_URL_EXPIRES_IN`, `GALLERY_UPLOAD_URL_EXPIRES_IN`, `THUMBNAIL_MAX_WIDTH`, `THUMBNAIL_QUALITY` 추가
- `packages/shared/src/index.ts` 수정 — 새 타입/상수 export

### Step 2: Prisma 스키마 + 의존성
- `schema.prisma` — `NotificationType` enum, `Notification` 모델 추가, `Gallery` 모델 변경 (`imageKey`, `thumbnailKey`, `uploadedBy`, `uploader` 관계), `User`에 `notifications`/`uploadedPhotos` 관계 추가
- 의존성 추가: `@nestjs/schedule`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `firebase-admin`, `sharp`, `@types/multer`

### Step 3: RedisService 확장
- `redis.service.ts` — `set`, `get`, `sAdd`, `sIsMember`, `expire` 메서드 추가 (크론잡 중복 방지용)

### Step 4: StorageModule (S3)
- `storage.service.ts` — `generateUploadUrl`, `generateDownloadUrl`, `downloadObject`, `uploadObject`, `deleteObject`
- `storage.module.ts` — `@Global()` 모듈

### Step 5: FcmModule (Firebase)
- `fcm.service.ts` — `onModuleInit`(firebase-admin 초기화), `sendToUser`, `sendToMultipleUsers`
- `fcm.module.ts` — `@Global()` 모듈

### Step 6: NotificationsModule
- `notifications.service.ts` — `createAndSend`, `findAllForUser` (커서 페이지네이션), `markAsRead`, `markAllAsRead`, `getUnreadCount`
- `notifications.controller.ts` — 4개 엔드포인트
- `dto/query-notification.dto.ts` — cursor/limit

### Step 7: GalleryModule
- `gallery.service.ts` — `requestUploadUrls`, `confirmUpload` (sharp 썸네일 생성 + FCM 알림), `findByProgram` (접근 권한 검증 + Signed URL), `delete`
- `gallery.controller.ts` — 4개 엔드포인트
- `dto/request-upload-url.dto.ts`, `dto/confirm-upload.dto.ts`

### Step 8: CronModule
- `cron.service.ts` — `@Cron(EVERY_HOUR)` 매시간 실행, 24시간 전 활동 알림, Redis TTL 48h 중복 방지
- `cron.module.ts` — `ScheduleModule.forRoot()` 포함

### Step 9: 통합
- `app.module.ts` — `StorageModule`, `FcmModule`, `NotificationsModule`, `GalleryModule`, `CronModule` import
- `programs.service.ts` — `findOne`에서 `gallery: true` → `_count: { select: { gallery: true } }` 변경
- `.env.example` — AWS/Firebase 환경변수 추가

## 신규 API 엔드포인트 (8개)

| Method | Endpoint | Auth | Role | 설명 |
|--------|----------|------|------|------|
| POST | /gallery/upload-url | JWT | INSTRUCTOR | Pre-signed 업로드 URL 요청 |
| POST | /gallery/confirm | JWT | INSTRUCTOR | 업로드 확인 + 썸네일 생성 |
| GET | /gallery/program/:programId | JWT | 참여자/강사 | 사진첩 조회 (Signed URL) |
| DELETE | /gallery/:id | JWT | INSTRUCTOR | 사진 삭제 |
| GET | /notifications | JWT | * | 알림 목록 (커서 페이지네이션) |
| GET | /notifications/unread-count | JWT | * | 미읽음 알림 수 |
| PATCH | /notifications/:id/read | JWT | * | 알림 읽음 처리 |
| PATCH | /notifications/read-all | JWT | * | 전체 읽음 처리 |

## 신규/수정 파일 목록

| 파일 | 작업 |
|------|------|
| `packages/shared/src/types/notification.ts` | 신규 |
| `packages/shared/src/types/gallery.ts` | 수정 |
| `packages/shared/src/constants/index.ts` | 수정 |
| `packages/shared/src/index.ts` | 수정 |
| `apps/server/package.json` | 의존성 추가 |
| `apps/server/src/prisma/schema.prisma` | 모델/enum 추가+수정 |
| `apps/server/src/redis/redis.service.ts` | 메서드 추가 |
| `apps/server/src/storage/storage.module.ts` | 신규 |
| `apps/server/src/storage/storage.service.ts` | 신규 |
| `apps/server/src/fcm/fcm.module.ts` | 신규 |
| `apps/server/src/fcm/fcm.service.ts` | 신규 |
| `apps/server/src/notifications/notifications.module.ts` | 신규 |
| `apps/server/src/notifications/notifications.controller.ts` | 신규 |
| `apps/server/src/notifications/notifications.service.ts` | 신규 |
| `apps/server/src/notifications/dto/query-notification.dto.ts` | 신규 |
| `apps/server/src/gallery/gallery.module.ts` | 신규 |
| `apps/server/src/gallery/gallery.controller.ts` | 신규 |
| `apps/server/src/gallery/gallery.service.ts` | 신규 |
| `apps/server/src/gallery/dto/request-upload-url.dto.ts` | 신규 |
| `apps/server/src/gallery/dto/confirm-upload.dto.ts` | 신규 |
| `apps/server/src/cron/cron.module.ts` | 신규 |
| `apps/server/src/cron/cron.service.ts` | 신규 |
| `apps/server/src/programs/programs.service.ts` | 수정 |
| `apps/server/src/app.module.ts` | 수정 |
| `apps/server/.env.example` | 수정 |

## 빌드 상태
- `pnpm run build` — 전체 빌드 성공 (shared, server, admin, mobile)
