import { ReservationsService } from '../src/reservations/reservations.service';
import { BusinessException } from '../src/common/exceptions/business.exception';

describe('ReservationsService - concurrency', () => {
  let service: ReservationsService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockPayments: any;

  // Simulates atomic reserved_count with in-memory state
  let reservedCount: number;
  const maxCapacity = 10;

  beforeEach(() => {
    reservedCount = 0;

    const txProxy: any = {
      program: {
        findUnique: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: 'prog-1',
            maxCapacity,
            reservedCount,
            price: 10000,
          }),
        ),
      },
      reservation: {
        create: jest.fn().mockImplementation((args: any) =>
          Promise.resolve({
            id: `res-${Math.random().toString(36).slice(2, 8)}`,
            ...args.data,
            program: { id: 'prog-1', title: 'Test', scheduleAt: new Date(), location: 'Seoul' },
          }),
        ),
      },
      $executeRaw: jest.fn().mockImplementation((...args: any[]) => {
        // Parse the template literal — the first raw arg after template is participantCount
        // For tagged template literals, args[0] is TemplateStringsArray, args[1..] are values
        const strings = args[0];
        const delta = args[1]; // participantCount

        if (typeof delta !== 'number') return Promise.resolve(0);

        // Check if this is an increment (contains +)
        const sql = Array.isArray(strings) ? strings.join('?') : '';
        const isIncrement = sql.includes('+');

        if (isIncrement) {
          if (reservedCount + delta <= maxCapacity) {
            reservedCount += delta;
            return Promise.resolve(1);
          }
          return Promise.resolve(0);
        }

        // Decrement
        if (reservedCount - delta >= 0) {
          reservedCount -= delta;
          return Promise.resolve(1);
        }
        return Promise.resolve(0);
      }),
    };

    mockPrisma = {
      $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn(txProxy)),
    };

    mockRedis = {
      acquireLock: jest.fn().mockResolvedValue('lock-value'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    mockPayments = {};

    service = new ReservationsService(mockPrisma, mockRedis, mockPayments);
  });

  describe('participantCount=1', () => {
    it('should not exceed maxCapacity with 50 concurrent requests', async () => {
      const attempts = 50;
      const results = await Promise.allSettled(
        Array.from({ length: attempts }, (_, i) =>
          service.create(`user-${i}`, { programId: 'prog-1', participantCount: 1 }),
        ),
      );

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      // Total seats reserved must be <= maxCapacity
      expect(successes.length).toBeLessThanOrEqual(maxCapacity);
      expect(successes.length).toBe(maxCapacity);
      expect(reservedCount).toBe(successes.length);

      // All failures should be CAPACITY_EXCEEDED
      for (const f of failures) {
        expect((f as PromiseRejectedResult).reason).toBeInstanceOf(BusinessException);
        expect((f as PromiseRejectedResult).reason.code).toBe('CAPACITY_EXCEEDED');
      }
    });
  });

  describe('participantCount=2', () => {
    it('should not exceed maxCapacity with 20 concurrent requests of 2 seats', async () => {
      const attempts = 20;
      const results = await Promise.allSettled(
        Array.from({ length: attempts }, (_, i) =>
          service.create(`user-${i}`, { programId: 'prog-1', participantCount: 2 }),
        ),
      );

      const successes = results.filter((r) => r.status === 'fulfilled');

      // Total seats reserved must be <= maxCapacity
      const totalSeats = successes.length * 2;
      expect(totalSeats).toBeLessThanOrEqual(maxCapacity);
      expect(reservedCount).toBe(totalSeats);
    });
  });

  describe('mixed participantCount', () => {
    it('should never overbooking with mixed counts', async () => {
      const attempts = Array.from({ length: 30 }, (_, i) => (i % 3) + 1); // 1, 2, 3, 1, 2, 3...
      const results = await Promise.allSettled(
        attempts.map((count, i) =>
          service.create(`user-${i}`, { programId: 'prog-1', participantCount: count }),
        ),
      );

      const successes = results.filter((r) => r.status === 'fulfilled');
      const totalSeats = successes.reduce((sum, r) => {
        const reservation = (r as PromiseFulfilledResult<any>).value;
        return sum + reservation.participantCount;
      }, 0);

      expect(totalSeats).toBeLessThanOrEqual(maxCapacity);
      expect(reservedCount).toBe(totalSeats);
    });
  });

  it('should throw CAPACITY_EXCEEDED with details', async () => {
    // Fill up capacity
    for (let i = 0; i < maxCapacity; i++) {
      await service.create(`user-fill-${i}`, { programId: 'prog-1', participantCount: 1 });
    }

    // Try to reserve when full
    await expect(
      service.create('user-overflow', { programId: 'prog-1', participantCount: 1 }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'CAPACITY_EXCEEDED',
      }),
    );
  });

  it('should throw VALIDATION_ERROR for participantCount <= 0', async () => {
    await expect(
      service.create('user-1', { programId: 'prog-1', participantCount: 0 }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
      }),
    );
  });
});
