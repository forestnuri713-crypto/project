-- AlterTable
ALTER TABLE "programs" ADD COLUMN "reserved_count" INTEGER NOT NULL DEFAULT 0;

-- Backfill reserved_count from active reservations
UPDATE "programs" p
SET "reserved_count" = COALESCE(r.used, 0)
FROM (
  SELECT "program_id", SUM("participant_count")::int AS used
  FROM "reservations"
  WHERE "status" IN ('PENDING', 'CONFIRMED')
  GROUP BY "program_id"
) r
WHERE p."id" = r."program_id";

-- Ensure programs with no active reservations remain 0
UPDATE "programs" SET "reserved_count" = 0 WHERE "reserved_count" IS NULL;

-- Add check constraint to prevent negative reserved_count
ALTER TABLE "programs" ADD CONSTRAINT "programs_reserved_count_nonnegative" CHECK ("reserved_count" >= 0);
