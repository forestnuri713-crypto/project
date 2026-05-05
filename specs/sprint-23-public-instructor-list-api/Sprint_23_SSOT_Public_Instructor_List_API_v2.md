# Sprint 23 SSOT — Public Instructor List API (Backend)

## 0) Goal
Add **public instructor enumeration** endpoint to unblock Sprint 22’s sitemap adapter wiring (Sprint 24).

- Ship: `GET /public/instructors`
- Guarantee: **APPROVED + isPublic=true only**
- Pagination: **cursor-based** with `(updatedAt, id)` tie-breaker
- Scope: **apps/server only** (no apps/web changes in this sprint)

---

## 1) Non-Goals
- No apps/web changes (sitemap adapter wiring is Sprint 24)
- No changes to existing `GET /public/instructors/:slug` behavior (including 308 slug-history redirect + 404 rules)
- No SEO extras (robots.txt, sitemap index, structured data)

---

## 2) Constraints (Non-Negotiable)
- **No data leakage**: must not list unapproved or non-public instructors
- Preserve existing public slug endpoint behavior and tests
- Prefer minimal response fields (sitemap-ready)
- Cursor pagination must be stable (no duplicates/skips across pages)

---

## 3) Contract Validation (M0)
### Required checks
- Confirm schema field names for:
  - Approval status (e.g., `instructorStatus` or equivalent)
  - Public visibility (e.g., `isPublic` or equivalent)
  - Timestamp (`updatedAt`)
- Confirm existing patterns for:
  - Pagination response shape (repo convention)
  - Public controller/service structure and DTO validation style

**Findings (M0 completed — 2026-02-18):**
- Approval field: `User.instructorStatus` (enum: NONE/APPLIED/APPROVED/REJECTED)
- Public field: **No `isPublic` column exists.** Derived from `instructorStatus === 'APPROVED'` (`public.service.ts:71,92`). Filter uses `instructorStatus: 'APPROVED'` to cover both.
- Timestamp field: `User.updatedAt` (`@updatedAt`, mapped `updated_at`)
- Pagination response convention:
  - [ ] `data.pageInfo { nextCursor, hasNext }`
  - [x] `data { nextCursor, hasMore }` — from `notifications.service.ts:97` (Option B)
  - [ ] Other

---

## 4) API Contract (Proposed)

### Endpoint
`GET /public/instructors`

### Query Params (DTO)
- `cursor?: string` — opaque cursor (`base64url(updatedAt|id)`)
- `limit?: number` — default 20, max 100 (may be adjusted to repo norm)

### Response Shape (MUST match repo convention)
Choose **one** based on existing repo usage:

**Option A (recommended if repo already uses pageInfo):**
```json
{
  "success": true,
  "data": {
    "items": [{ "slug": "kim-forest-a1b2", "updatedAt": "2026-02-18T00:00:00.000Z" }],
    "pageInfo": { "nextCursor": "base64...", "hasNext": true }
  }
}
```

**Option B (if repo uses flat fields):**
```json
{
  "success": true,
  "data": {
    "items": [{ "slug": "kim-forest-a1b2", "updatedAt": "2026-02-18T00:00:00.000Z" }],
    "nextCursor": "base64...",
    "hasMore": true
  }
}
```

### Items payload (minimal fields)
- `slug: string`
- `updatedAt: string (ISO8601)`

---

## 5) Filtering Rules (Hardcoded, Not User-Facing)
**Must include ALL of:**
- `status = APPROVED` (actual field name from M0)
- `isPublic = true` (actual field name from M0)
- `slug IS NOT NULL`

No other filters exposed in Sprint 23.

---

## 6) Pagination Strategy (Cursor)

### Cursor encoding
- Encode: `base64url(${updatedAt.toISOString()}|${id})`
- Decode: `base64url → string → split('|') → [updatedAtISO, id]`

### Sorting
- `ORDER BY updatedAt DESC, id DESC`

### Next-page WHERE (tie-breaker)
- `(updatedAt < cursorUpdatedAt)`
  OR
- `(updatedAt = cursorUpdatedAt AND id < cursorId)`

### Invalid cursor behavior (policy)
- Preferred: treat invalid cursor as first page **with dev-only warning**, no prod log spam.
- Alternative (stricter): 400 Bad Request (only if repo conventions prefer strict validation).

---

## 7) Implementation Plan (Milestones)

### M0 — Data Recon + Convention Check
- Confirm approval/public/timestamp field names
- Confirm pagination response convention in repo
- Confirm controller route ordering requirement

**Acceptance**
- SSOT §3 filled with findings

---

### M1 — Controller + Service + DTO
- Add DTO: `query-public-instructors.dto.ts`
- Add controller route: `@Get('instructors')` **before** `@Get('instructors/:slug')`
- Add service method: `listPublicApprovedInstructors(cursor?, limit)`

**Acceptance**
- Returns only APPROVED+public+slugged items
- Shape matches chosen convention

---

### M2 — Cursor Pagination
- Implement decode/encode + tie-breaker WHERE
- Use `take = limit + 1` to detect `hasNext/hasMore`

**Acceptance**
- Stable paging across 2+ pages, no duplicates/skips

---

### M3 — Tests (backend)
Minimum tests:
1) Approved+public only (non-public excluded)
2) Unapproved excluded
3) Pagination correctness across pages (cursor)
4) Invalid cursor behavior (first-page fallback or 400, per chosen policy)

**Acceptance**
- Jest suite passes and does not flake

---

### M4 — Docs / Handoff
- Update `status.md`: add Sprint 23 row + brief section (match existing style)
- Add Sprint 24 hook: “wire sitemap adapter to this endpoint”

**Acceptance**
- status.md updated without touching unrelated/garbled blocks

---

## 8) Files (Planned)

### New
- `apps/server/src/public/dto/query-public-instructors.dto.ts`
- `apps/server/test/public-instructor-list.spec.ts`
- `specs/sprint-23-public-instructor-list/SSOT.md` (this file)

### Modified
- `apps/server/src/public/public.controller.ts`
- `apps/server/src/public/public.service.ts`
- `status.md`

---

## 9) Risks
- R1: Missing `isPublic=true` filter → leakage risk (SEV-High)
- R2: Pagination instability → SEO and client issues (SEV-Med)
- R3: Response shape inconsistency → downstream churn (SEV-Med)

Mitigations:
- Hard filter in service + tests
- `(updatedAt,id)` tie-breaker + `take=limit+1`
- Follow repo response conventions strictly

---

## 10) Definition of Done
- `GET /public/instructors` shipped
- Returns **APPROVED + public only**
- Cursor pagination stable
- Tests pass
- Existing `GET /public/instructors/:slug` unaffected
- status.md updated (minimal, style-consistent)

---

## 11) Sprint 24 Hook
Once list endpoint exists:
- Replace `apps/web/src/lib/sitemap/instructors.stub.ts` with real adapter fetching slugs
- Emit instructor URLs in sitemap (with safeGetUrls + revalidate already in place)
