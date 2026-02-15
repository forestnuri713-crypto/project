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

## M2 --- Admin Metrics Dashboard (Read-only) ✅ DONE

**Route:** `/` (`apps/admin/src/app/page.tsx`) — NOT `/admin/dashboard`

**M2-1 (skeleton + error handling):**
- `GET /admin/dashboard/stats` contract confirmed (see `DASHBOARD_STATS_CONTRACT.md`)
- Loading state implemented
- Error panel shows `error.code` + `requestId`
- Retry button re-fetches stats
- No backend changes

**M2-2 (metric cards):**
- All 5 fields rendered as cards: totalUsers, totalReservations, totalRevenue, pendingPrograms, pendingInstructors
- Consistent `toLocaleString()` formatting on all values
- Responsive grid layout (1/2/3 columns)
- No charts, no derived metrics, no new abstractions

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
