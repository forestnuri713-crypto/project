/**
 * Reconciliation script: verifies remaining_capacity matches
 * capacity - SUM(active participant_count) for all program_schedules.
 *
 * Modes:
 *   Dry-run (default): detect mismatches, exit(1) if any found.
 *   Repair:            FIX=1 CONFIRM=FIX_CAPACITY — fix mismatches with
 *                      optimistic updates inside a single $transaction.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/reconcile-capacity.ts
 *   FIX=1 CONFIRM=FIX_CAPACITY npx ts-node -r tsconfig-paths/register src/scripts/reconcile-capacity.ts
 */
import { PrismaClient } from '@prisma/client';

export interface MismatchRow {
  id: string;
  capacity: number;
  remaining_capacity: number;
  active_used: number;
  expected_remaining: number;
}

export interface ReconcileResult {
  mode: 'dry-run' | 'repair';
  scanned: number;
  mismatches: number;
  repaired: number;
  errors: string[];
}

const TAG = '[reconcile-capacity]';

export async function detectMismatches(
  prisma: PrismaClient,
): Promise<MismatchRow[]> {
  return prisma.$queryRaw<MismatchRow[]>`
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
}

export async function reconcile(
  prisma: PrismaClient,
  opts: { fix: boolean; confirm: string },
): Promise<ReconcileResult> {
  const isRepair = opts.fix && opts.confirm === 'FIX_CAPACITY';
  const mode = isRepair ? 'repair' : 'dry-run';

  console.log(`${TAG} mode=${mode}`);

  const mismatches = await detectMismatches(prisma);

  // Count total schedules for summary
  const totalResult = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM "program_schedules"
  `;
  const scanned = totalResult[0]?.count ?? 0;

  console.log(`${TAG} scanned=${scanned} mismatches=${mismatches.length}`);

  if (mismatches.length === 0) {
    console.log(`${TAG} summary: scanned=${scanned} mismatches=0 repaired=0`);
    return { mode, scanned, mismatches: 0, repaired: 0, errors: [] };
  }

  for (const row of mismatches) {
    console.log(
      `${TAG} mismatch schedule=${row.id} capacity=${row.capacity} remaining=${row.remaining_capacity} active_used=${row.active_used} expected=${row.expected_remaining}`,
    );
  }

  if (!isRepair) {
    console.log(
      `${TAG} summary: scanned=${scanned} mismatches=${mismatches.length} repaired=0`,
    );
    return {
      mode,
      scanned,
      mismatches: mismatches.length,
      repaired: 0,
      errors: [],
    };
  }

  // Repair mode: single transaction with optimistic updates
  let repaired = 0;
  const errors: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const row of mismatches) {
      const affected: number = await (tx as any).$executeRaw`
        UPDATE "program_schedules"
        SET "remaining_capacity" = ${row.expected_remaining},
            "updated_at" = NOW()
        WHERE "id" = ${row.id}
          AND "remaining_capacity" = ${row.remaining_capacity}
      `;

      if (affected === 0) {
        const msg = `optimistic update failed for schedule=${row.id} (concurrent modification)`;
        errors.push(msg);
        throw new Error(`${TAG} ${msg}`);
      }

      repaired++;
      console.log(
        `${TAG} repaired schedule=${row.id} old=${row.remaining_capacity} new=${row.expected_remaining}`,
      );
    }
  });

  console.log(
    `${TAG} summary: scanned=${scanned} mismatches=${mismatches.length} repaired=${repaired}`,
  );

  return { mode, scanned, mismatches: mismatches.length, repaired, errors };
}

// CLI entry point
if (require.main === module) {
  const prisma = new PrismaClient();
  const fix = process.env.FIX === '1';
  const confirm = process.env.CONFIRM ?? '';

  reconcile(prisma, { fix, confirm })
    .then((result) => {
      if (result.mismatches > 0 && result.mode === 'dry-run') {
        process.exit(1);
      }
    })
    .catch((e) => {
      console.error(`${TAG} failed:`, e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
