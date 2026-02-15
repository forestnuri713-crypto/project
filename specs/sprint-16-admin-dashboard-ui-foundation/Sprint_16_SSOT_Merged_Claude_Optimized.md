# Sprint 16 --- Admin Dashboard UI Foundation (SSOT)

Status: Active\
Branch: sprint-16/admin-dashboard-ui-foundation\
Phase: 5 (Admin Dashboard Frontend)

------------------------------------------------------------------------

# 🔒 Executive Execution Layer (Claude Runbook --- Ultra Compressed)

1.  No backend changes.
2.  Use existing admin endpoints only.
3.  All errors follow: { success:false, error:{ code, message, requestId
    } }
4.  Never branch on error.message.
5.  Always surface requestId in UI.
6.  Respect limit vs pageSize differences (use resolvedLimit).
7.  Use existing Admin page patterns (use client, AdminLayout, api
    client).
8.  Implement CP5 incrementally:
    -   Step 1: Minimal working page
    -   Step 2: Dry-run preview (server-supported)
    -   Step 3: Confirmation + execution
    -   Step 4: Result + retry
9.  Stop after each milestone for approval.

------------------------------------------------------------------------

# 🧱 Architectural Rules (Authoritative)

## Error Contract

All failures: { success:false, error:{ code, message, requestId } }

UI must: - Use code for logic - Display requestId - Never depend on
message text

## Rendering Model

-   Follow existing Admin pattern (client page + AdminLayout)
-   Keep consistency across pages
-   Avoid architectural drift during Sprint 16

## Pagination Rule

-   /admin/programs → uses limit
-   /admin/bulk-cancel-jobs/:jobId/items → uses pageSize
-   Use DTO resolvedLimit mapping pattern

------------------------------------------------------------------------

# 📦 CP Overview

CP0 GET /admin/instructors/:id ✅\
CP1 API client envelope alignment ✅\
CP2 Sidebar update ✅\
CP3 Instructor list page ✅\
CP4 Instructor detail page ✅\
CP5 Bulk Cancel UI (current focus)

------------------------------------------------------------------------

# CP5 --- Bulk Cancel UI

Route: /bulk-cancel

## Backend Endpoints (Verified Existing)

-   GET /admin/programs
-   POST /admin/sessions/:sessionId/bulk-cancel (path param naming per
    backend contract)
-   POST /admin/bulk-cancel-jobs/:jobId/start
-   GET /admin/bulk-cancel-jobs/:jobId
-   GET /admin/bulk-cancel-jobs/:jobId/items
-   POST /admin/bulk-cancel-jobs/:jobId/retry

Note: UI variable may use programId if domain requires, but must respect
backend path param naming.

------------------------------------------------------------------------

## Milestone 1 --- Minimal Working Page

-   Program selector (paginated)
-   Reason input
-   POST bulk-cancel with dryRun: true
-   Error panel (code + requestId)
-   End-to-end submission works

------------------------------------------------------------------------

## Milestone 2 --- Preview

-   Use backend dryRun support
-   Display job summary
-   Allow proceed to execution

------------------------------------------------------------------------

## Milestone 3 --- Execute

-   Confirmation modal
-   POST /start
-   Fetch job summary

------------------------------------------------------------------------

## Milestone 4 --- Result

-   Paginated job items
-   Retry failed items
-   Reset option

------------------------------------------------------------------------

# ⚠ Risk Controls

1.  No message-based branching.
2.  No client-side reinterpretation of backend contracts.
3.  Respect pagination contract differences.
4.  Maintain single-route workflow unless job detail route required
    later.

------------------------------------------------------------------------

# Definition of Done

-   Bulk Cancel UI works end-to-end.
-   Dry-run + execution flow stable.
-   Errors standardized.
-   No backend modifications.
-   Architecture ready for Sprint 17 expansion.

------------------------------------------------------------------------

# Next Preview (Sprint 17)

-   Admin metrics dashboard
-   Settlement management UI
-   Audit log viewer
