/**
 * CP4 Backfill: Populate programScheduleId for existing reservations.
 *
 * For each reservation where programScheduleId is NULL:
 *   1. Resolve startAt from program.scheduleAt
 *   2. Upsert a ProgramSchedule with (programId, startAt)
 *   3. Link the reservation to that schedule
 *
 * Safety:
 *   - DRY_RUN=1  → logs what would happen without writing reservation updates
 *   - Per-program transactions to reduce lock duration
 *   - Idempotent: updateMany includes programScheduleId: null guard
 *   - Skips reservations whose program has no scheduleAt
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-schedule.ts
 *   DRY_RUN=1 npx ts-node -r tsconfig-paths/register src/scripts/backfill-schedule.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  if (DRY_RUN) console.log('[DRY_RUN] No reservation updates will be written.\n');

  const orphaned = await prisma.reservation.findMany({
    where: { programScheduleId: null },
    select: {
      id: true,
      programId: true,
      program: { select: { scheduleAt: true, maxCapacity: true } },
    },
  });

  console.log(`Scanned: ${orphaned.length} reservations with NULL programScheduleId`);

  if (orphaned.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  // Group by programId, skip if scheduleAt missing
  const byProgram = new Map<
    string,
    { scheduleAt: Date; maxCapacity: number; reservationIds: string[] }
  >();
  const skipped: string[] = [];

  for (const r of orphaned) {
    const scheduleAt = r.program?.scheduleAt ?? null;
    if (!scheduleAt) {
      skipped.push(r.id);
      console.error(`SKIP reservation=${r.id} program=${r.programId} (no scheduleAt)`);
      continue;
    }
    const existing = byProgram.get(r.programId);
    if (existing) {
      existing.reservationIds.push(r.id);
    } else {
      byProgram.set(r.programId, {
        scheduleAt,
        maxCapacity: r.program.maxCapacity,
        reservationIds: [r.id],
      });
    }
  }

  console.log(`Programs to process: ${byProgram.size}`);

  let linked = 0;

  for (const [programId, info] of byProgram) {
    await prisma.$transaction(async (tx) => {
      const schedule = await tx.programSchedule.upsert({
        where: {
          programId_startAt: { programId, startAt: info.scheduleAt },
        },
        create: {
          programId,
          startAt: info.scheduleAt,
          capacity: info.maxCapacity,
          remainingCapacity: info.maxCapacity,
          status: 'ACTIVE',
        },
        update: {},
      });

      if (DRY_RUN) {
        console.log(
          `  [DRY_RUN] program ${programId}: would link ${info.reservationIds.length} reservations → schedule ${schedule.id}`,
        );
        linked += info.reservationIds.length;
      } else {
        const result = await tx.reservation.updateMany({
          where: {
            id: { in: info.reservationIds },
            programScheduleId: null,
          },
          data: { programScheduleId: schedule.id },
        });
        linked += result.count;
        console.log(
          `  program ${programId}: ${result.count} reservations → schedule ${schedule.id}`,
        );
      }
    });
  }

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Scanned:  ${orphaned.length}`);
  console.log(`Linked:   ${linked}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Skipped:  ${skipped.length}`);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
