import { ReservationsService } from '../src/reservations/reservations.service';
import { BusinessException } from '../src/common/exceptions/business.exception';

/**
 * Barrier: resolves all waiters once n callers have arrived.
 */
function barrier(n: number): () => Promise<void> {
  let arrived = 0;
  let release: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return () => {
    arrived++;
    if (arrived >= n) release();
    return gate;
  };
}

// ── In-memory DB state ──

let remainingCapacity: number;
let reservedCount: number;
let reservationStore: Map<string, any>;

const CAPACITY = 10;
const SCHEDULE_AT = new Date('2026-04-01');

function buildExecuteRaw() {
  return jest.fn().mockImplementation((...args: any[]) => {
    const sql = Array.isArray(args[0]) ? args[0].join('?') : '';
    const delta = args[1];

    if (sql.includes('program_schedules')) {
      if (sql.includes('remaining_capacity" - ')) {
        if (typeof delta === 'number' && remainingCapacity >= delta) {
          remainingCapacity -= delta;
          return Promise.resolve(1);
        }
        return Promise.resolve(0);
      }
      if (sql.includes('remaining_capacity" + ')) {
        if (typeof delta === 'number') remainingCapacity += delta;
        return Promise.resolve(1);
      }
    }
    if (sql.includes('programs')) {
      if (typeof delta === 'number') {
        if (sql.includes('reserved_count" + ')) reservedCount += delta;
        else if (sql.includes('reserved_count" - ') && reservedCount >= delta) reservedCount -= delta;
      }
      return Promise.resolve(1);
    }
    return Promise.resolve(1);
  });
}

function buildTxProxy(reservationOverrides?: Record<string, any>) {
  const proxy: any = {
    program: {
      findUnique: jest.fn().mockImplementation(() =>
        Promise.resolve({ id: 'prog-1', maxCapacity: CAPACITY, reservedCount, price: 10000 }),
      ),
    },
    programSchedule: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'sch-1', programId: 'prog-1', capacity: CAPACITY,
        remainingCapacity, status: 'ACTIVE',
      }),
    },
    reservation: {
      create: jest.fn().mockImplementation((args: any) => {
        const res = {
          id: `res-${Math.random().toString(36).slice(2, 8)}`,
          ...args.data,
          status: args.data.status ?? 'PENDING',
          program: { id: 'prog-1', title: 'Test', scheduleAt: SCHEDULE_AT, location: 'Seoul' },
        };
        reservationStore.set(res.id, res);
        return Promise.resolve(res);
      }),
      findUnique: jest.fn().mockImplementation((args: any) => {
        const res = reservationStore.get(args.where.id);
        if (!res) return Promise.resolve(null);
        return Promise.resolve({
          id: res.id, status: res.status,
          participantCount: res.participantCount,
          programScheduleId: res.programScheduleId,
          programId: res.programId,
          program: { id: 'prog-1', title: 'Test', scheduleAt: SCHEDULE_AT },
        });
      }),
      updateMany: jest.fn().mockImplementation((args: any) => {
        const res = reservationStore.get(args.where.id);
        if (!res) return Promise.resolve({ count: 0 });
        const allowed: string[] = args.where.status?.in ?? [args.where.status];
        if (!allowed.includes(res.status)) return Promise.resolve({ count: 0 });
        res.status = args.data.status;
        return Promise.resolve({ count: 1 });
      }),
    },
    $executeRaw: buildExecuteRaw(),
  };
  if (reservationOverrides) Object.assign(proxy.reservation, reservationOverrides);
  return proxy;
}

function preTxFindUnique() {
  return jest.fn().mockImplementation((args: any) => {
    const res = reservationStore.get(args.where.id);
    if (!res) return Promise.resolve(null);
    return Promise.resolve({
      ...res,
      program: {
        id: 'prog-1', title: 'Test', scheduleAt: SCHEDULE_AT,
        maxCapacity: CAPACITY, price: 10000, instructorId: 'inst-1',
        description: '', location: 'Seoul', latitude: 0, longitude: 0,
        minAge: 0, approvalStatus: 'APPROVED', rejectionReason: null,
        isB2b: false, safetyGuide: null, insuranceCovered: false,
        ratingAvg: 0, reviewCount: 0, reservedCount: 0,
        providerId: null, createdAt: new Date(), updatedAt: new Date(),
      },
      payment: null,
      userId: res.userId,
      totalPrice: res.totalPrice,
    });
  });
}

interface BuildServiceOpts {
  txResOverrides?: Record<string, any>;
  txGate?: () => Promise<void>;
}

function buildService(opts: BuildServiceOpts = {}) {
  const mockPrisma: any = {
    $transaction: jest.fn(async (fn: any) => {
      if (opts.txGate) await opts.txGate();
      return fn(buildTxProxy(opts.txResOverrides));
    }),
    reservation: { findUnique: preTxFindUnique() },
  };
  const mockRedis: any = {
    acquireLock: jest.fn().mockResolvedValue('lock-value'),
    releaseLock: jest.fn().mockResolvedValue(true),
  };
  const mockPayments: any = {
    processRefund: jest.fn().mockResolvedValue(undefined),
  };
  return new ReservationsService(mockPrisma, mockRedis, mockPayments);
}

// ── Tests ──

describe('ReservationsService - concurrency (remaining_capacity)', () => {
  beforeEach(() => {
    remainingCapacity = CAPACITY;
    reservedCount = 0;
    reservationStore = new Map();
  });

  // ─── 1. Concurrent booking race (barrier-based, looped) ───

  describe('concurrent booking — barrier-based race', () => {
    it('exactly 1 succeeds when remaining_capacity=1 (20 iterations)', async () => {
      for (let iter = 0; iter < 20; iter++) {
        remainingCapacity = 1;
        reservedCount = 0;
        reservationStore = new Map();

        const service = buildService();
        const wait = barrier(2);

        const results = await Promise.allSettled([
          wait().then(() =>
            service.create('user-a', { programId: 'prog-1', programScheduleId: 'sch-1', participantCount: 1 }),
          ),
          wait().then(() =>
            service.create('user-b', { programId: 'prog-1', programScheduleId: 'sch-1', participantCount: 1 }),
          ),
        ]);

        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected');

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect((failures[0] as PromiseRejectedResult).reason.code).toBe('CAPACITY_EXCEEDED');

        // DB invariant: remaining_capacity = 0
        expect(remainingCapacity).toBe(0);

        // DB invariant: only 1 active reservation
        const active = Array.from(reservationStore.values()).filter(
          (r) => r.programScheduleId === 'sch-1' && ['PENDING', 'CONFIRMED'].includes(r.status),
        );
        expect(active).toHaveLength(1);
      }
    });
  });

  // ─── 2. Concurrent cancel — tx-entry barrier, looped ───

  describe('concurrent cancel — tx-entry barrier, looped invariant check', () => {
    it('remaining_capacity increases by exactly participant_count once (20 iterations)', async () => {
      const participantCount = 3;

      for (let iter = 0; iter < 20; iter++) {
        remainingCapacity = CAPACITY - participantCount; // 7
        reservedCount = participantCount;
        reservationStore = new Map();

        const resId = `res-iter-${iter}`;
        reservationStore.set(resId, {
          id: resId,
          userId: 'user-1',
          programId: 'prog-1',
          programScheduleId: 'sch-1',
          status: 'PENDING',
          participantCount,
          totalPrice: participantCount * 10000,
        });

        // Barrier at $transaction entry so both cancels pass pre-tx checks then race
        const txGate = barrier(2);
        const service = buildService({ txGate });
        const capacityBefore = remainingCapacity;

        const results = await Promise.allSettled([
          service.cancel(resId, 'user-1'),
          service.cancel(resId, 'user-1'),
        ]);

        // DB invariant: remaining_capacity increased by exactly participantCount ONCE
        expect(remainingCapacity).toBe(capacityBefore + participantCount);

        // DB invariant: reservation is CANCELLED
        expect(reservationStore.get(resId).status).toBe('CANCELLED');

        // At least one call succeeded
        const successes = results.filter((r) => r.status === 'fulfilled');
        expect(successes.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ─── 3. Rollback safety ───

  describe('rollback — failure after decrement restores capacity', () => {
    it('remaining_capacity unchanged when reservation.create fails after decrement', async () => {
      const initial = CAPACITY;
      let decrementObserved = false;

      const mockPrisma: any = {
        $transaction: jest.fn(async (fn: any) => {
          const snapshot = remainingCapacity;
          try {
            return await fn(buildTxProxy({
              create: jest.fn().mockImplementation(() => {
                // Prove decrement happened before create was called
                decrementObserved = remainingCapacity < snapshot;
                return Promise.reject(new Error('FK violation'));
              }),
            }));
          } catch (e) {
            remainingCapacity = snapshot; // simulate PG rollback
            throw e;
          }
        }),
        reservation: { findUnique: preTxFindUnique() },
      };
      const service = new ReservationsService(
        mockPrisma,
        { acquireLock: jest.fn().mockResolvedValue('lk'), releaseLock: jest.fn() } as any,
        { processRefund: jest.fn() } as any,
      );

      await expect(
        service.create('user-1', { programId: 'prog-1', programScheduleId: 'sch-1', participantCount: 3 }),
      ).rejects.toThrow('FK violation');

      // Decrement did happen inside the tx before create threw
      expect(decrementObserved).toBe(true);
      // DB invariant: remaining_capacity restored to pre-tx value
      expect(remainingCapacity).toBe(initial);
      // DB invariant: no reservation persisted
      expect(reservationStore.size).toBe(0);
    });
  });

  // ─── 4. Reconciliation ───

  describe('reconciliation — remaining_capacity consistency', () => {
    it('remaining_capacity = capacity - active participant_count after book+cancel', async () => {
      const service = buildService();

      const r1 = await service.create('user-1', { programId: 'prog-1', programScheduleId: 'sch-1', participantCount: 4 });
      await service.create('user-2', { programId: 'prog-1', programScheduleId: 'sch-1', participantCount: 2 });
      await service.cancel(r1.id, 'user-1');

      const activeParticipants = Array.from(reservationStore.values())
        .filter((r) => r.programScheduleId === 'sch-1' && ['PENDING', 'CONFIRMED'].includes(r.status))
        .reduce((sum: number, r: any) => sum + r.participantCount, 0);

      expect(remainingCapacity).toBe(CAPACITY - activeParticipants);
    });
  });

  // ─── Basic validation ───

  it('should throw CAPACITY_EXCEEDED when full', async () => {
    remainingCapacity = 0;
    const service = buildService();
    await expect(
      service.create('user-1', { programId: 'prog-1', programScheduleId: 'sch-1', participantCount: 1 }),
    ).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
  });

  it('should throw VALIDATION_ERROR for participantCount <= 0', async () => {
    const service = buildService();
    await expect(
      service.create('user-1', { programId: 'prog-1', programScheduleId: 'sch-1', participantCount: 0 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
