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
