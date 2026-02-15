/**
 * Backfill: Generate slugs for existing APPROVED instructors.
 *
 * Slug format: {romanized-name}-{first 4 chars of userId}
 * Collision resolution: append -2, -3, ...
 *
 * Safety:
 *   - DRY_RUN=1 → logs what would happen without writing
 *   - Per-user updates (no batch transaction needed)
 *   - Idempotent: skips users that already have a slug
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-slug.ts
 *   DRY_RUN=1 npx ts-node -r tsconfig-paths/register src/scripts/backfill-slug.ts
 */
import { PrismaClient } from '@prisma/client';
import { slugify } from '../public/slug.utils';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';

async function generateSlug(name: string, userId: string): Promise<string> {
  const base = slugify(name);
  const shortId = userId.slice(0, 4);
  const candidate = base ? `${base}-${shortId}` : `inst-${shortId}`;

  const existing = await prisma.user.findFirst({
    where: { slug: candidate },
    select: { id: true },
  });

  if (!existing || existing.id === userId) {
    return candidate;
  }

  for (let suffix = 2; suffix <= 100; suffix++) {
    const attempt = `${candidate}-${suffix}`;
    const conflict = await prisma.user.findFirst({
      where: { slug: attempt },
      select: { id: true },
    });
    if (!conflict || conflict.id === userId) {
      return attempt;
    }
  }

  return `${base || 'inst'}-${userId.slice(0, 8)}`;
}

async function main() {
  if (DRY_RUN) console.log('[DRY_RUN] No updates will be written.\n');

  const users = await prisma.user.findMany({
    where: {
      slug: null,
      instructorStatus: 'APPROVED',
    },
    select: { id: true, name: true },
  });

  console.log(`Found ${users.length} APPROVED instructors without slug`);

  if (users.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const slug = await generateSlug(user.name, user.id);

    if (DRY_RUN) {
      console.log(`  [DRY_RUN] ${user.id} (${user.name}) → ${slug}`);
      updated++;
    } else {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { slug },
        });
        console.log(`  ${user.id} (${user.name}) → ${slug}`);
        updated++;
      } catch (e) {
        console.error(`  SKIP ${user.id} (${user.name}): ${e instanceof Error ? e.message : e}`);
        skipped++;
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Scanned:  ${users.length}`);
  console.log(`Updated:  ${updated}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Skipped:  ${skipped}`);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
