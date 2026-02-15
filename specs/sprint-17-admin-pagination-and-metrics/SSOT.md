# SPRINT 17 --- Admin Pagination Completion + Metrics Foundation (v2.1)

**Phase:** 5 (Admin FE)\
**Alignment Update:** Bulk-cancel job items implemented as embedded Step
4 section (NOT separate route)

------------------------------------------------------------------------

## Hard Constraints

-   No backend changes (apps/server untouched).
-   No API contract modification.
-   Preserve unified error envelope + requestId behavior.
-   Keep scope incremental and isolated.

------------------------------------------------------------------------

## M1 --- CP5 M4: Bulk Cancel Job Items Pagination + Retry ✅ DONE

**Target Location** - Embedded in `/bulk-cancel` Step 4 (Job Result
section) - NOT a separate `/admin/bulk-cancel-jobs/:jobId/items` route

**Completed:**
- Items pagination via `GET /admin/bulk-cancel-jobs/:jobId/items` (page, pageSize, result filter)
- URL searchParams sync (jobId, itemsPage, pageSize, resultFilter) with `router.replace`
- URL restore on mount: fetches job summary from `jobId` param, restores items view
- Retry via `POST /admin/bulk-cancel-jobs/:jobId/retry` + summary/items refresh
- `requestId` + `error.code` shown in error panel (all catch paths)
- Page clamping: `itemsPage` auto-corrected to `[1..totalPages]` on data arrival
- API contract documented in `CP5_M4_CONTRACT.md`

**Smoke Test:** A/B/C/D PASS (code-level validation)

------------------------------------------------------------------------

## M2 --- Admin Metrics Dashboard (Read-only)

**Target** - `/admin/dashboard`

**Objectives** - Render metrics from existing GET
/admin/dashboard/stats. - Display: - pendingInstructors - reservation
stats - financial stats already provided - Consistent loading / empty /
error states. - Show requestId on error.

**Guardrails** - No new stats aggregation. - No backend aggregation
change. - Pure presentation layer only.

**Acceptance Criteria** - Dashboard renders stable on reload. - Error
envelope respected. - Zero backend diff.

------------------------------------------------------------------------

## Risks

-   API param mismatch (limit vs pageSize).
-   URL-state desync with embedded workflow.
-   Over-abstracting list logic.
-   Accidentally modifying shared API client behavior.

------------------------------------------------------------------------

## Definition of Done

-   apps/server diff = 0
-   apps/admin typecheck + build pass
-   Manual smoke test: bulk cancel end-to-end still works
