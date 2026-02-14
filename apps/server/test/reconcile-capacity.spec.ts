import { reconcile, MismatchRow } from '../src/scripts/reconcile-capacity';

// ── Mock PrismaClient builder ──

function buildMockPrisma(opts: {
  mismatches: MismatchRow[];
  totalCount?: number;
  executeRawResult?: number;
}) {
  const { mismatches, totalCount = 5, executeRawResult = 1 } = opts;

  const executeRaw = jest.fn().mockResolvedValue(executeRawResult);

  const prisma: any = {
    $queryRaw: jest.fn().mockImplementation((...args: any[]) => {
      const sql = Array.isArray(args[0]) ? args[0].join('') : '';
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve([{ count: totalCount }]);
      }
      // mismatch detection query
      return Promise.resolve(mismatches);
    }),
    $transaction: jest.fn(async (fn: any) => {
      const tx = { $executeRaw: executeRaw };
      return fn(tx);
    }),
  };

  return { prisma, executeRaw };
}

// ── Tests ──

describe('reconcile-capacity', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // T1: No mismatches
  it('should report 0 mismatches and return mode=dry-run', async () => {
    const { prisma } = buildMockPrisma({ mismatches: [], totalCount: 3 });

    const result = await reconcile(prisma, { fix: false, confirm: '' });

    expect(result).toEqual({
      mode: 'dry-run',
      scanned: 3,
      mismatches: 0,
      repaired: 0,
      errors: [],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // T2: Dry-run with mismatches — does NOT call $executeRaw
  it('should detect mismatches in dry-run without repairing', async () => {
    const mismatches: MismatchRow[] = [
      {
        id: 'sch-1',
        capacity: 10,
        remaining_capacity: 8,
        active_used: 4,
        expected_remaining: 6,
      },
    ];
    const { prisma, executeRaw } = buildMockPrisma({ mismatches });

    const result = await reconcile(prisma, { fix: false, confirm: '' });

    expect(result.mode).toBe('dry-run');
    expect(result.mismatches).toBe(1);
    expect(result.repaired).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  // T2b: FIX=1 without CONFIRM should still be dry-run
  it('should remain dry-run when FIX=1 but CONFIRM is missing', async () => {
    const mismatches: MismatchRow[] = [
      {
        id: 'sch-2',
        capacity: 10,
        remaining_capacity: 7,
        active_used: 5,
        expected_remaining: 5,
      },
    ];
    const { prisma, executeRaw } = buildMockPrisma({ mismatches });

    const result = await reconcile(prisma, { fix: true, confirm: '' });

    expect(result.mode).toBe('dry-run');
    expect(result.repaired).toBe(0);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  // T3: Repair mode success — optimistic update
  it('should repair mismatches when FIX=1 and CONFIRM=FIX_CAPACITY', async () => {
    const mismatches: MismatchRow[] = [
      {
        id: 'sch-1',
        capacity: 10,
        remaining_capacity: 8,
        active_used: 4,
        expected_remaining: 6,
      },
      {
        id: 'sch-2',
        capacity: 20,
        remaining_capacity: 15,
        active_used: 7,
        expected_remaining: 13,
      },
    ];
    const { prisma, executeRaw } = buildMockPrisma({
      mismatches,
      executeRawResult: 1,
    });

    const result = await reconcile(prisma, {
      fix: true,
      confirm: 'FIX_CAPACITY',
    });

    expect(result.mode).toBe('repair');
    expect(result.mismatches).toBe(2);
    expect(result.repaired).toBe(2);
    expect(result.errors).toEqual([]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(2);
  });

  // T4: Repair mode — 0 rows affected → error + rollback
  it('should throw when optimistic update returns 0 rows', async () => {
    const mismatches: MismatchRow[] = [
      {
        id: 'sch-1',
        capacity: 10,
        remaining_capacity: 8,
        active_used: 4,
        expected_remaining: 6,
      },
    ];
    const { prisma } = buildMockPrisma({
      mismatches,
      executeRawResult: 0,
    });

    await expect(
      reconcile(prisma, { fix: true, confirm: 'FIX_CAPACITY' }),
    ).rejects.toThrow('optimistic update failed');
  });
});
