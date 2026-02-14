# Sprint 14 — Admin Readiness Hardening (SSOT)

> SSOT location: `specs/sprint-14-admin-readiness-hardening/SPEC_SPRINT14_SSOT.md` (single source of truth)

Baseline: `7135c5c` (Sprint 13 frozen)

---

## 1. Goal

Stabilise admin API contracts and harden operational tooling before
Phase 5 (admin dashboard frontend).

**Topics:**

| # | Topic | Status |
|---|-------|--------|
| 1 | `admin-api-contract-stabilization` | Done |
| 2 | `reconcile-capacity-script` | Done |

---

## 2. Non-goals

- Change reservation/cancel flow (Sprint 13 scope, complete)
- Add CLI argument parsing library
- Automatic scheduling (cron) of the reconciliation script
- UI for reconciliation results
- Frontend admin dashboard (Phase 5)

---

## 3. Topics

### Topic 1 — admin-api-contract-stabilization (Done)

PR: https://github.com/forestnuri713-crypto/project/pull/3

**Scope:**

- Add `@Max(100)` + `resolvedLimit` to 6 admin query DTOs
- `AdminQueryProvidersDto`: `search`/`query` alias + `resolvedSearch`; `limit`/`pageSize` alias + `resolvedLimit`
- `QueryBulkCancelItemsDto`: `limit`/`pageSize` alias + `resolvedLimit`
- `admin.service.ts`: use `resolvedLimit` across list methods; `findProviders` uses `resolvedSearch`
- `admin-bulk-cancel.service.ts` `getJobItems`: `pageSize` → `limit`; keep optional `totalPages` (additive)
- `admin.controller.ts` `getBulkCancelJobItems` uses `query.resolvedLimit`
- Tests updated: `review.spec.ts` and `admin-provider.spec.ts` use DTO instances for getter access

### Topic 2 — reconcile-capacity-script (Done)

PR: _(to be added after PR creation)_

- [ ] Add PR link after PR creation

**Scope:**

- Add repair mode with `FIX=1` + `CONFIRM=FIX_CAPACITY` dual env-var guard
- Optimistic update: `WHERE id = $id AND remaining_capacity = $old`
- Single `prisma.$transaction` for all repairs (all-or-nothing)
- Structured summary logging with `[reconcile-capacity]` tag
- Exported `reconcile()` function for testability

**Modes:**

| Mode | Env Vars | Behaviour |
|------|----------|-----------|
| Dry-run (default) | _(none)_ | Detect mismatches, log, exit(1) if any found |
| Repair | `FIX=1 CONFIRM=FIX_CAPACITY` | Detect + fix mismatches using optimistic UPDATE inside single `$transaction` |

**Optimistic Update SQL:**

```sql
UPDATE "program_schedules"
SET "remaining_capacity" = $expected
WHERE "id" = $id
  AND "remaining_capacity" = $old
```

If affected rows = 0, the row was concurrently modified — the script throws
an error and rolls back the entire transaction.

**Structured Summary Logging:**

```
[reconcile-capacity] mode=dry-run|repair
[reconcile-capacity] scanned=N mismatches=M
[reconcile-capacity] mismatch schedule=<id> capacity=C remaining=R active_used=U expected=E
[reconcile-capacity] repaired schedule=<id> old=R new=E
[reconcile-capacity] summary: scanned=N mismatches=M repaired=K
```

---

## 4. Decision Log

### Topic 1 — admin-api-contract-stabilization

| Decision | Rationale |
|----------|-----------|
| Base list response: `{ items, total, page, limit }` | Consistent contract for all admin list endpoints |
| Non-breaking aliases via deprecated DTO fields + resolver getters | Existing callers using `pageSize`/`query` continue to work |
| `limit` max 100 enforced via `@Max(100)` + `resolvedLimit` clamp | Prevent unbounded queries from frontend/API consumers |
| bulk-cancel `getJobItems` may include `totalPages` as optional extra field | Additive, non-breaking; useful for pagination UI |

### Topic 2 — reconcile-capacity-script

| Decision | Rationale |
|----------|-----------|
| `FIX=1` + `CONFIRM=FIX_CAPACITY` dual guard | Prevents accidental repair; explicit operator intent required |
| Optimistic `WHERE remaining_capacity = $old` | Detects concurrent modification between detect and repair phases |
| Single `$transaction` for all repairs | Atomic all-or-nothing; partial fixes are worse than no fix |
| Exported `reconcile()` function | Enables unit testing without `require.main` side-effects |

---

## 5. Test / Verification

### Topic 1 — admin-api-contract-stabilization

- `npx tsc --noEmit`: PASS
- Sprint 14 scope tests: PASS
- Pre-existing failing suites tracked separately: `reservation-cancel.spec.ts`, `reservation-schedule.spec.ts`

### Topic 2 — reconcile-capacity-script

- `npx tsc --noEmit`: PASS
- `npx jest reconcile-capacity`: 5 passed, 0 failed

| # | Test Case | Assertion | Status |
|---|-----------|-----------|--------|
| T1 | No mismatches | `result.mismatches=0`, no `$transaction` call | PASS |
| T2 | Dry-run with mismatches | `$executeRaw` NOT called, `repaired=0` | PASS |
| T2b | FIX=1 without CONFIRM | Stays dry-run, no repair | PASS |
| T3 | Repair mode success | `$executeRaw` called per mismatch, `repaired=2` | PASS |
| T4 | Repair mode 0 rows | Throws `optimistic update failed`, tx rolls back | PASS |

**Affected Files (Topic 2):**

| File | Change |
|------|--------|
| `src/scripts/reconcile-capacity.ts` | Add repair mode, optimistic update, structured logging, exported `reconcile()` |
| `test/reconcile-capacity.spec.ts` | New — 5 test cases |

---

## 6. Risks / Rollback

### Topic 1 — admin-api-contract-stabilization

- **Risk:** Deprecated aliases (`pageSize`, `query`) may be removed in a future sprint, breaking callers that haven't migrated.
- **Rollback:** Revert PR #3. Aliases are additive — removing them restores the original contract.

### Topic 2 — reconcile-capacity-script

- **Risk:** Optimistic update fails if a concurrent reservation modifies `remaining_capacity` between detect and repair.
- **Mitigation:** The entire `$transaction` rolls back on any 0-row update — no partial fixes.
- **Rollback:** Dry-run mode is the default; no writes occur unless both env vars are set. To revert a completed repair, re-run dry-run to verify state, then apply corrective values manually or restore from backup.

---

## 7. Progress

- [x] Topic 1: admin-api-contract-stabilization (PR #3)
- [x] Topic 2: reconcile-capacity-script
- [x] tsc --noEmit PASS
- [x] jest reconcile-capacity PASS (5/5)
