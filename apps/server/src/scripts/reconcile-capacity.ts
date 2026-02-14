/**
 * Dev-only reconciliation script: verifies remaining_capacity matches
 * capacity - SUM(active participant_count) for all program_schedules.
 *
 * Returns 0 mismatches on success, exits with code 1 if any found.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/reconcile-capacity.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MismatchRow {
  id: string;
  capacity: number;
  remaining_capacity: number;
  active_used: number;
  expected_remaining: number;
}

async function main() {
  const mismatches: MismatchRow[] = await prisma.$queryRaw`
    SELECT
      ps."id",
      ps."capacity",
      ps."remaining_capacity",
      COALESCE(r.used, 0)::int AS active_used,
      (ps."capacity" - COALESCE(r.used, 0))::int AS expected_remaining
    FROM "program_schedules" ps
    LEFT JOIN (
      SELECT "program_schedule_id",
             SUM("participant_count")::int AS used
      FROM "reservations"
      WHERE "status" IN ('PENDING', 'CONFIRMED')
      GROUP BY "program_schedule_id"
    ) r ON ps."id" = r."program_schedule_id"
    WHERE ps."remaining_capacity" != (ps."capacity" - COALESCE(r.used, 0))
  `;

  if (mismatches.length > 0) {
    console.error(`FAIL: ${mismatches.length} mismatch(es) found:`);
    for (const row of mismatches) {
      console.error(
        `  schedule=${row.id} capacity=${row.capacity} remaining=${row.remaining_capacity} active_used=${row.active_used} expected=${row.expected_remaining}`,
      );
    }
    process.exit(1);
  }

  console.log('OK: 0 mismatches');
}

main()
  .catch((e) => {
    console.error('Reconciliation failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
