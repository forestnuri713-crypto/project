# Sprint 13 — Atomic Schedule Capacity (SSOT)

Baseline: `0edade8` (Sprint 12 frozen)

---

## 0. Problem

Current capacity enforcement (reservations.service.ts L102-125) uses a
count-based query inside a Prisma transaction:

```ts
const activeCount = await tx.reservation.count({
  where: { programScheduleId: scheduleId, status: { in: ['PENDING', 'CONFIRMED'] } },
});
if (activeCount + participantCount > capacity) throw ...
```

This is **not concurrency-safe** — two transactions can read the same
`activeCount` before either inserts, both pass the check, and capacity is
exceeded. The Redis lock on `program:{id}:lock` mitigates this at the
program level but does not cover per-schedule granularity.

---

## 1. Goal

Replace count-based capacity check with an **atomic decrement** of
`remaining_capacity` on `program_schedules`, enforced by a PostgreSQL
CHECK constraint as a data integrity guard.

---

## 2. Non-goals

- Remove `programs.reserved_count` (kept for program-level analytics)
- Change API request/response shapes
- Distributed lock removal (separate cleanup task)
- Multi-schedule reservations

---

## 3. Domain Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| I1 | `remaining_capacity >= 0` | CHECK constraint (data integrity guard, not concurrency control) |
| I2 | `remaining_capacity = capacity - SUM(active participant_count)` | Backfill + atomic ops |
| I3 | Creation decrements `remaining_capacity` atomically | `$executeRaw UPDATE ... WHERE remaining_capacity >= $delta` |
| I4 | Cancellation increments `remaining_capacity` atomically | `$executeRaw UPDATE ... WHERE id = $scheduleId` |
| I5 | Cancellation is idempotent | `updateMany` with status IN (PENDING, CONFIRMED) — only first caller transitions |
| I6 | `remaining_capacity <= capacity` | Logical invariant; maintained by correct increment/decrement pairing |

---

## 4. Schema Diff

### 4.1 Prisma Schema

```diff
 model ProgramSchedule {
   id        String                @id @default(uuid())
   programId String                @map("program_id")
   startAt   DateTime              @map("start_at")
   endAt     DateTime?             @map("end_at")
   capacity  Int
+  remainingCapacity Int           @map("remaining_capacity")
   status    ProgramScheduleStatus @default(ACTIVE)
   createdAt DateTime              @default(now()) @map("created_at")
   updatedAt DateTime              @updatedAt @map("updated_at")
   ...
 }
```

### 4.2 Migration SQL

```sql
-- Step 1: Add column (nullable temporarily)
-- Acquires short ACCESS EXCLUSIVE lock on program_schedules.
ALTER TABLE "program_schedules"
  ADD COLUMN "remaining_capacity" INTEGER;

-- Step 2: Backfill from current active reservations
-- Acquires row-level locks on matched program_schedules rows.
UPDATE "program_schedules" ps
SET "remaining_capacity" = ps."capacity" - COALESCE(r.used, 0)
FROM (
  SELECT "program_schedule_id",
         SUM("participant_count")::int AS used
  FROM "reservations"
  WHERE "status" IN ('PENDING', 'CONFIRMED')
    AND "program_schedule_id" IS NOT NULL
  GROUP BY "program_schedule_id"
) r
WHERE ps."id" = r."program_schedule_id";

-- Step 3: Schedules with no active reservations
UPDATE "program_schedules"
SET "remaining_capacity" = "capacity"
WHERE "remaining_capacity" IS NULL;

-- Step 4: Set NOT NULL after backfill
-- Acquires brief ACCESS EXCLUSIVE lock.
ALTER TABLE "program_schedules"
  ALTER COLUMN "remaining_capacity" SET NOT NULL;

-- Step 5: CHECK constraint — data integrity guard only
-- Scans table once for validation.
ALTER TABLE "program_schedules"
  ADD CONSTRAINT "program_schedules_remaining_capacity_nonneg"
  CHECK ("remaining_capacity" >= 0);
```

Safe for moderate production traffic but should be run during low-load window.

---

## 5. Atomic Update Patterns

**Note:** `$executeRaw` returns the number of affected rows as an `int`.
A return value of `0` means the WHERE condition was not met and must be
treated as a failure.

### 5.1 Reservation Creation — Decrement

```ts
// Inside tx — replaces count-based check entirely
const decremented = await tx.$executeRaw`
  UPDATE "program_schedules"
  SET "remaining_capacity" = "remaining_capacity" - ${participantCount},
      "updated_at" = NOW()
  WHERE "id" = ${scheduleId}
    AND "status" = 'ACTIVE'
    AND "remaining_capacity" >= ${participantCount}
`;

if (decremented === 0) {
  throw new BusinessException('CAPACITY_EXCEEDED', '잔여석이 부족합니다', 400);
}
```

**Why this is concurrency-safe:**
- A single-row UPDATE is atomic at the row level in PostgreSQL.
- `WHERE remaining_capacity >= participantCount` is the concurrency guard:
  if two transactions race, PostgreSQL serialises the row-level write lock.
  The second transaction re-evaluates the WHERE clause against the
  committed value and fails cleanly if capacity is insufficient.
- The CHECK constraint (`remaining_capacity >= 0`) is a **data integrity
  guard only** — a safety net against application bugs. It does NOT
  provide concurrency control. Concurrency safety comes entirely from the
  conditional WHERE clause in the atomic UPDATE.

### 5.2 Reservation Cancellation — Increment

```ts
// Inside tx — three-step idempotent cancel

// Step 0: Load reservation to obtain participant_count and program_schedule_id
const reservation = await tx.reservation.findUnique({
  where: { id: reservationId },
  select: { participantCount: true, programScheduleId: true, status: true },
});

if (!reservation) throw new BusinessException('RESERVATION_NOT_FOUND', ...);
if (reservation.status === 'CANCELLED') throw new BusinessException('ALREADY_CANCELLED', ...);
if (reservation.status === 'COMPLETED') throw new BusinessException('COMPLETED', ...);

// Step 1: Transition status atomically — only first concurrent caller succeeds
const cancelled = await tx.reservation.updateMany({
  where: {
    id: reservationId,
    status: { in: ['PENDING', 'CONFIRMED'] },
  },
  data: { status: 'CANCELLED' },
});

// Step 2: Only increment if this call performed the transition
if (cancelled.count === 1 && reservation.programScheduleId) {
  const incremented = await tx.$executeRaw`
    UPDATE "program_schedules"
    SET "remaining_capacity" = "remaining_capacity" + ${reservation.participantCount},
        "updated_at" = NOW()
    WHERE "id" = ${reservation.programScheduleId}
  `;

  // $executeRaw returns affected row count; 0 means schedule row not found
  if (incremented === 0) {
    throw new BusinessException('INVARIANT_VIOLATION', 'schedule not found during cancel', 500);
  }
}
```

**Idempotency guarantee:**
- `updateMany` with `status IN ('PENDING', 'CONFIRMED')` ensures only the
  first concurrent caller transitions the reservation. The second caller
  gets `cancelled.count === 0` and skips the increment entirely.
- No double-increment is possible, even under concurrent cancel requests.

---

## 6. Concurrency Scenario Walkthrough

### Scenario A: Two concurrent bookings, capacity = 5, remaining = 3

```
T1: UPDATE ... SET remaining = 3 - 2 = 1 WHERE remaining >= 2  → rows=1 ✓
T2: UPDATE ... SET remaining = 1 - 2 = -1 WHERE remaining >= 2 → rows=0 ✗ (fails)
```

PostgreSQL serialises row-level updates: T2's UPDATE waits for T1 to
commit, then re-evaluates the WHERE clause against the committed value.

### Scenario B: Concurrent book + cancel on same schedule

```
T1 (book):   remaining = 3 - 1 = 2  → commits
T2 (cancel): remaining = 2 + 1 = 3  → commits
```

Both succeed; final state is correct.

### Scenario C: Double cancel (idempotency)

```
T1 (cancel): updateMany WHERE status IN (PENDING,CONFIRMED) → count=1, remaining += 2  → commits
T2 (cancel): updateMany WHERE status IN (PENDING,CONFIRMED) → count=0, skip increment
```

T2's `updateMany` matches zero rows (status already CANCELLED by T1).
Increment never executes. No double-restore.

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| `program_schedule_id` is NULL on old reservation | Backfill (Sprint 12 CP4) resolved this. Cancel path checks for null and skips increment. |
| Schedule status CANCELLED | Decrement WHERE includes `status = 'ACTIVE'` — cannot book. Cancel still increments (capacity restored for potential reactivation). |
| `participant_count = 0` | Rejected at DTO validation (existing L20-26). |
| Admin changes capacity after bookings | Requires separate `remaining_capacity += (newCapacity - oldCapacity)` operation (out of scope). |
| Reservation COMPLETED | No capacity change — completed reservations still consume capacity. |

---

## 8. Rollout Strategy

### CP1: Schema + Migration + Backfill
1. Add `remaining_capacity` column (nullable)
2. Backfill from `capacity - SUM(active participant_count)`
3. Set NOT NULL + CHECK constraint
4. Update Prisma schema, generate client

### CP2: Reservation Creation — Atomic Decrement
1. Replace count-based check (L102-125) with `$executeRaw` decrement
2. Keep `programs.reserved_count` increment (unchanged)
3. Keep Redis lock temporarily (remove in separate cleanup)

### CP3: Reservation Cancellation — Atomic Increment
1. Add three-step idempotent cancel: load → `updateMany` → conditional increment
2. Keep `programs.reserved_count` decrement (unchanged)

### CP4: Verification + Cleanup
1. Reconciliation query: verify `remaining_capacity` matches
   `capacity - SUM(active participant_count)` for all schedules
2. Integration tests for concurrent booking scenarios
3. Optional: remove Redis lock dependency (separate PR)

---

## 9. Affected Files

| File | Change |
|------|--------|
| `schema.prisma` | Add `remainingCapacity` field |
| `migrations/2026XXXX_add_remaining_capacity/migration.sql` | Column + backfill + constraint |
| `reservations.service.ts` | Replace count-based check with atomic decrement; add three-step idempotent cancel |
| `reservation-schedule.spec.ts` | Update capacity tests |
| `reservation-concurrency.spec.ts` | Add concurrent decrement tests |

---

## Progress

- CP1: Schema + migration + backfill ✔
- CP2: Atomic decrement on create ✔
- CP3: Atomic increment on cancel ✔
- CP4: Verification + tests — pending
