# Sprint 16 — Admin Dashboard UI Foundation (SSOT)

> SSOT: `specs/sprint-16-admin-dashboard-ui-foundation/SPEC_SPRINT16_SSOT.md`
> Baseline: `f3b46d4` (main)

---

## 1. Goal

Add three admin workflows (Instructor review, Bulk cancel, Settlement detail)
to the existing `apps/admin` Next.js app and fix the API client to parse
Sprint 15 error envelope.

| # | Topic | Status |
|---|-------|--------|
| 0 | API client Sprint 15 envelope fix | Pending |
| 1 | Instructors Review UI (list + detail + actions) | Pending |
| 2 | Bulk Cancel Operations UI | Pending |
| 3 | Settlements Detail (READ-ONLY) | Pending |

**Constraints:** Desktop-first. No DB changes. One non-breaking backend
addition (GET /admin/instructors/:id). Client uses canonical `limit`;
endpoints requiring `pageSize` are normalised in the API client layer.

---

## 2. Non-goals

- Mobile-responsive design
- Additional backend endpoints beyond the single instructor GET
- Settlement confirm/pay on detail page (already on list page)
- `resolvedLimit`/`resolvedSearch` refactors
- i18n

---

## 3. Existing Codebase (Verified)

### 3.1 `apps/admin` scaffold

Verified via `ls apps/` → `admin  mobile  server` and
`apps/admin/package.json` → `@sooptalk/admin`, Next 14, port 3001.

**Existing files used by Sprint 16:**

| File | Role |
|------|------|
| `src/services/api.ts` | fetch wrapper; `ApiError(status, message)` |
| `src/components/Sidebar.tsx` | `NAV_ITEMS` array, 6 entries |
| `src/components/Pagination.tsx` | Reusable; props: `page, total, pageSize, onChange` |
| `src/components/AdminLayout.tsx` | `ProtectedRoute` + `Sidebar` + `<main>` |
| `src/contexts/AuthContext.tsx` | JWT localStorage; ADMIN role check |
| `src/app/settlements/page.tsx` | Settlement list (has interface bugs — see Topic 3) |

### 3.2 API client bug

`src/services/api.ts` throws `new ApiError(res.status, body.message || ...)`.
Sprint 15 error shape (verified in `apps/server/src/common/filters/api-error.filter.ts`)
is `{ success: false, error: { code, message, requestId } }`.
Client reads `body.message` (top-level) but must read `body.error.message`.

### 3.3 Pagination field map

Verified from each DTO file in `apps/server/src/admin/dto/`:

| Endpoint | DTO field | Response key |
|---|---|---|
| `GET /admin/instructors` | `limit` | `limit` |
| `GET /admin/programs` | `limit` | `limit` |
| `GET /admin/users` | `limit` | `limit` |
| `GET /admin/reviews` | `limit` | `limit` |
| `GET /admin/settlements` | `limit` | `limit` |
| `GET /admin/providers` | `pageSize` | `pageSize` |
| `GET .../bulk-cancel.../items` | `pageSize` | `pageSize` + `totalPages` |

**Client normalisation:** API client always sends `limit`. A helper
`buildQuery()` maps `limit` → `pageSize` for the two legacy endpoints.
Response normalisation: `response.limit ?? response.pageSize`.

---

## 4. Routes

### 4.1 Existing (no changes)

| Route | Purpose |
|---|---|
| `/` | Dashboard |
| `/login` | Kakao OAuth |
| `/programs/pending` | Program approval |
| `/settlements` | Settlement list |
| `/users` | User management |
| `/providers` | Provider list/CRUD |
| `/providers/[id]/profile` | Mini homepage editor |
| `/reviews` | Review moderation |

### 4.2 New (Sprint 16)

| Route | Topic | Purpose |
|---|---|---|
| `/instructors` | T1 | Instructor list (status tabs + search) |
| `/instructors/[id]` | T1 | Instructor detail (approve/reject/certs) |
| `/bulk-cancel` | T2 | Program search → dry-run → create job |
| `/bulk-cancel/[jobId]` | T2 | Job report (items + start/retry) |
| `/settlements/[id]` | T3 | Settlement detail (read-only breakdown) |

### 4.3 Sidebar update

Add after '프로그램 승인':
```
{ href: '/instructors', label: '강사 관리' }
{ href: '/bulk-cancel', label: '일괄 취소' }
```

---

## 5. API Inventory

### 5.1 Instructors

| Method | Path | Params | Response |
|---|---|---|---|
| `GET` | `/admin/instructors` | `?instructorStatus&search&page&limit` | `{ items, total, page, limit }` |
| `GET` | `/admin/instructors/:id` | — | Single instructor object (**NEW — Sprint 16 backend**) |
| `PATCH` | `/admin/instructors/:id/approve` | _(empty body)_ | Updated user |
| `PATCH` | `/admin/instructors/:id/reject` | `{ reason: string }` required | Updated user |
| `PATCH` | `/admin/instructors/:id/certifications` | `{ certifications: [{type,label,iconType}] }` max 10 | `{ id, name, certifications }` |

**Instructor item fields** (from `admin.service.ts` `findInstructorApplications` select):
`id, email, name, role, phoneNumber, profileImageUrl, instructorStatus,
instructorStatusReason, certifications, createdAt`

**New endpoint spec — `GET /admin/instructors/:id`:**
- Controller: add to `admin.controller.ts`, guard already applied (ADMIN)
- Service: `prisma.user.findUnique({ where: { id }, select: { ...same fields... } })`
- Throws `NotFoundException` if not found
- Non-breaking: additive route only

**Errors:**
| HTTP | Code | Trigger |
|---|---|---|
| 404 | `NOT_FOUND` | User not found (approve/reject/certs/detail) |
| 400 | `BAD_REQUEST` | Not APPLIED status (approve/reject) or not INSTRUCTOR (certs) |
| 400 | `VALIDATION_ERROR` | Empty reason / array > 10 |

### 5.2 Bulk Cancel

| Method | Path | Params | Response |
|---|---|---|---|
| `GET` | `/admin/programs` | `?search&approvalStatus&page&limit` | `{ items, total, page, limit }` |
| `POST` | `/admin/sessions/:sessionId/bulk-cancel` | `{ reason, dryRun?: true }` | Dry-run or Job+items |
| `POST` | `/admin/bulk-cancel-jobs/:jobId/start` | _(empty)_ | Job or `{ message, jobId }` |
| `GET` | `/admin/bulk-cancel-jobs/:jobId` | — | Job summary + program |
| `GET` | `/admin/bulk-cancel-jobs/:jobId/items` | `?page&pageSize&result` | `{ items, total, page, pageSize, totalPages }` |
| `POST` | `/admin/bulk-cancel-jobs/:jobId/retry` | _(empty)_ | Job or `{ message, jobId }` |

**Note:** `:sessionId` is actually a `programId` — service calls
`program.findUnique({ where: { id: sessionId } })`.

**Dry-run response** (`dryRun: true`):
```
{ dryRun, mode, sessionId, totalTargets, estimatedRefunds: [{ reservationId, userId, totalPrice, estimatedRefund }] }
```

**Job summary fields:**
`id, sessionId, reason, mode, status, totalTargets, successCount,
failedCount, skippedCount, startedAt, finishedAt, program: { id, title, scheduleAt }`

**Job statuses:** `PENDING | RUNNING | COMPLETED | COMPLETED_WITH_ERRORS | FAILED`

**Errors:**
| HTTP | Code | Trigger |
|---|---|---|
| 404 | `BULK_CANCEL_JOB_NOT_FOUND` | Program or job not found |
| 409 | `BULK_CANCEL_JOB_RUNNING` | Already running job for program |
| 409 | `BULK_CANCEL_JOB_COMPLETED` | Job already finished |

### 5.3 Settlements

| Method | Path | Params | Response |
|---|---|---|---|
| `GET` | `/admin/settlements` | `?status&page&limit` | `{ items, total, page, limit }` |
| `GET` | `/admin/settlements/:id` | — | Settlement + `instructor: { id, name, email, phoneNumber }` |

**Settlement fields:**
`id, instructorId, periodStart, periodEnd, grossAmount, refundAmount,
platformFee, notificationCost, b2bCommission, netAmount, status, paidAt,
memo, createdAt, updatedAt`

**Statuses:** `PENDING | CONFIRMED | PAID`

**Existing page bugs** (verified by reading `settlements/page.tsx`):
- Interface declares `totalAmount` — field does not exist; actual: `grossAmount`/`netAmount`
- Interface declares `providerId` — actual: `instructorId`
- Missing instructor name column (response includes `instructor.name`)

---

## 6. UI Patterns

### 6.1 State model

All existing pages use this pattern (verified across all page files):
```
useState<T | null>(null)
→ null: "로딩 중..."
→ items.length === 0: empty message
→ error: currently unhandled (silent catch)
```

Sprint 16 pages add error state display using the fixed `ApiError` class:
`catch (err) → if (err instanceof ApiError) show err.message + err.requestId`

### 6.2 Pagination normalisation

Existing `Pagination` component accepts `pageSize` prop.
Client normalises: `pageSize={data.limit ?? data.pageSize}`.
Query builder sends `limit` except for providers (`pageSize`) and
bulk-cancel-items (`pageSize`).

---

## 7. Topic Detail

### T1 — Instructor List (`/instructors`)

- Tab filter: APPLIED (default) / APPROVED / REJECTED / ALL
- Search: debounced input (300ms), sends `search` param
- Table: name, email, phone, status badge, certs count, createdAt
- Row click → `/instructors/[id]`
- Badges: APPLIED=yellow, APPROVED=green, REJECTED=red

### T1 — Instructor Detail (`/instructors/[id]`)

- Fetches `GET /admin/instructors/:id` (new endpoint)
- Profile section: name, email, phone, profileImage, status, statusReason
- Actions (visible when `instructorStatus === 'APPLIED'`):
  - Approve: confirm dialog → PATCH .../approve → toast → back to list
  - Reject: modal with required reason textarea → PATCH .../reject → toast → back to list
- Certifications editor (always visible):
  - Add/remove `{ type, label, iconType }` rows (max 10)
  - Save → PATCH .../certifications → toast

### T2 — Bulk Cancel Search (`/bulk-cancel`)

1. Program search via `GET /admin/programs?approvalStatus=APPROVED&search=...`
2. Select program → `POST /admin/sessions/:id/bulk-cancel { reason:"", dryRun:true }`
3. Preview: mode, totalTargets, estimated refund sum
4. Reason input (required, max 200) → confirm → POST without dryRun → navigate to report

### T2 — Bulk Cancel Report (`/bulk-cancel/[jobId]`)

- Summary: `GET /admin/bulk-cancel-jobs/:jobId` — status banner + counts
- Items: `GET .../items?page&pageSize&result` — table with result filter tabs
- Start button: visible when PENDING → POST .../start
- Retry button: visible when COMPLETED_WITH_ERRORS → POST .../retry
- Auto-poll: 3s interval while status === RUNNING

### T3 — Settlement Detail (`/settlements/[id]`)

- `GET /admin/settlements/:id`
- Instructor card: name, email, phoneNumber
- Period display: periodStart ~ periodEnd
- Breakdown card: grossAmount, refundAmount, platformFee, b2bCommission, notificationCost → netAmount
- Status badge, memo, paidAt
- Back link to `/settlements`
- READ-ONLY: no action buttons

### T3 — Settlement List Fix (`/settlements` existing)

- Fix interface: `totalAmount` → `netAmount`, `providerId` → `instructorId`
- Add instructor name column
- Add row click → `/settlements/[id]`

---

## 8. Test Plan

### Unit

| # | File | Assertion |
|---|------|-----------|
| U1 | `__tests__/services/api.test.ts` | `ApiError` parses `{ success:false, error: { code, message, requestId } }` |
| U2 | `__tests__/services/api.test.ts` | Falls back to `body.message` when `body.error` absent |
| U3 | `__tests__/services/api.test.ts` | 204 returns null |

### Backend (new endpoint)

| # | File | Assertion |
|---|------|-----------|
| B1 | `apps/server/test/admin-instructor-detail.spec.ts` | GET /:id returns instructor fields |
| B2 | same | GET /:id with non-existent ID → 404 NOT_FOUND envelope |

### E2E Smoke

| # | File | Scenario |
|---|------|----------|
| E1 | `e2e/sidebar.spec.ts` | Sidebar has 강사 관리 + 일괄 취소 links |
| E2 | `e2e/instructor-list.spec.ts` | `/instructors` loads, tab filter works |

---

## 9. Rollback

| Scope | Action |
|-------|--------|
| Full | Revert Sprint 16 commits; remove GET /admin/instructors/:id backend route |
| Frontend-only | Delete new page dirs + revert sidebar; backend GET is harmless |
| Per-topic | Delete topic route dir; remove sidebar entry |
| No DB rollback | Zero schema changes |

---

## 10. Implementation Plan (<=15 lines)

```
CP0  Backend: GET /admin/instructors/:id (admin.controller.ts + admin.service.ts) + test
CP1  Fix services/api.ts: parse body.error envelope; add code/requestId to ApiError + tests
CP2  Sidebar.tsx: add 강사 관리 + 일괄 취소 nav items
CP3  app/instructors/page.tsx: list (status tabs, search, table, pagination)
CP4  app/instructors/[id]/page.tsx: detail (profile, approve/reject, certs editor)
CP5  app/bulk-cancel/page.tsx: program search → dry-run preview → create job
CP6  app/bulk-cancel/[jobId]/page.tsx: job report (summary, items table, start/retry, poll)
CP7  app/settlements/[id]/page.tsx: read-only detail (breakdown card, instructor info)
CP8  Fix app/settlements/page.tsx: correct interface + add instructor col + row link
CP9  E2E smoke tests + tsc --noEmit
```

**Affected backend files (CP0 only):**
- `apps/server/src/admin/admin.controller.ts` (add GET route)
- `apps/server/src/admin/admin.service.ts` (add findInstructor method)
- `apps/server/test/admin-instructor-detail.spec.ts` (new)

**Affected frontend files:**
- `apps/admin/src/services/api.ts` (fix)
- `apps/admin/src/components/Sidebar.tsx` (edit)
- `apps/admin/src/app/instructors/page.tsx` (new)
- `apps/admin/src/app/instructors/[id]/page.tsx` (new)
- `apps/admin/src/app/bulk-cancel/page.tsx` (new)
- `apps/admin/src/app/bulk-cancel/[jobId]/page.tsx` (new)
- `apps/admin/src/app/settlements/[id]/page.tsx` (new)
- `apps/admin/src/app/settlements/page.tsx` (fix)

---

## 11. Progress

- [ ] CP0: Backend GET /admin/instructors/:id + test
- [ ] CP1: API client envelope fix + tests
- [ ] CP2: Sidebar update
- [ ] CP3: Instructor list page
- [ ] CP4: Instructor detail page
- [ ] CP5: Bulk cancel search + create
- [ ] CP6: Bulk cancel job report
- [ ] CP7: Settlement detail page
- [ ] CP8: Settlement list fix
- [ ] CP9: E2E smoke + typecheck
