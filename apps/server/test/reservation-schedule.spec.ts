import { ReservationsService } from '../src/reservations/reservations.service';

describe('ReservationsService - ProgramSchedule integration', () => {
  let service: ReservationsService;
  let schedules: Map<string, any>;
  let reservations: any[];
  let reservedCount: number;
  let upsertCalls: number;

  function makeTxProxy() {
    return {
      program: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prog-1',
          maxCapacity: 10,
          reservedCount,
          price: 5000,
        }),
      },
      programSchedule: {
        findUnique: jest.fn().mockImplementation((args: any) => {
          const id = args.where.id;
          return Promise.resolve(schedules.get(id) ?? null);
        }),
        upsert: jest.fn().mockImplementation((args: any) => {
          upsertCalls++;
          const key = `${args.where.programId_startAt.programId}:${args.where.programId_startAt.startAt.toISOString()}`;
          for (const [, s] of schedules) {
            const sKey = `${s.programId}:${s.startAt.toISOString()}`;
            if (sKey === key) return Promise.resolve(s);
          }
          const newSchedule = {
            id: `sch-auto-${upsertCalls}`,
            ...args.create,
            startAt: new Date(args.create.startAt),
          };
          schedules.set(newSchedule.id, newSchedule);
          return Promise.resolve(newSchedule);
        }),
      },
      reservation: {
        count: jest.fn().mockImplementation((args: any) => {
          const count = reservations.filter(
            (r) =>
              r.programScheduleId === args.where.programScheduleId &&
              ['PENDING', 'CONFIRMED'].includes(r.status),
          ).length;
          return Promise.resolve(count);
        }),
        create: jest.fn().mockImplementation((args: any) => {
          const res = { id: `res-${reservations.length + 1}`, ...args.data };
          reservations.push(res);
          return Promise.resolve({ ...res, program: { id: 'prog-1', title: 'Test', scheduleAt: new Date(), location: 'Seoul' } });
        }),
      },
      $executeRaw: jest.fn().mockImplementation(() => {
        if (reservedCount < 10) {
          reservedCount++;
          return Promise.resolve(1);
        }
        return Promise.resolve(0);
      }),
    };
  }

  beforeEach(() => {
    schedules = new Map();
    schedules.set('sch-1', {
      id: 'sch-1',
      programId: 'prog-1',
      startAt: new Date('2026-03-01'),
      endAt: null,
      capacity: 3,
      status: 'ACTIVE',
    });
    reservations = [];
    reservedCount = 0;
    upsertCalls = 0;

    const txProxy = makeTxProxy();
    const mockPrisma: any = {
      $transaction: jest.fn((fn: any) => fn(txProxy)),
    };
    const mockRedis: any = {
      acquireLock: jest.fn().mockResolvedValue('lock-val'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    const mockPayments: any = {};

    service = new ReservationsService(mockPrisma, mockRedis, mockPayments);
  });

  it('should create reservation with programScheduleId', async () => {
    const result = await service.create('user-1', {
      programId: 'prog-1',
      programScheduleId: 'sch-1',
      participantCount: 1,
    });
    expect(result.programScheduleId).toBe('sch-1');
    expect(reservations).toHaveLength(1);
  });

  it('should create reservation via fallback (programId+startAt) and reuse schedule', async () => {
    const dto = {
      programId: 'prog-1',
      startAt: '2026-04-01T10:00:00.000Z',
      participantCount: 1,
    };

    const r1 = await service.create('user-1', dto);
    expect(r1.programScheduleId).toMatch(/^sch-auto-/);

    const r2 = await service.create('user-2', dto);
    // Same schedule reused — upsert returns existing
    expect(r2.programScheduleId).toBe(r1.programScheduleId);
    expect(upsertCalls).toBe(2); // upsert called twice but returns same schedule
  });

  it('should block reservation when schedule capacity reached', async () => {
    // Fill schedule capacity (3)
    for (let i = 0; i < 3; i++) {
      await service.create(`user-${i}`, {
        programId: 'prog-1',
        programScheduleId: 'sch-1',
        participantCount: 1,
      });
    }
    expect(reservations).toHaveLength(3);

    // 4th should fail
    await expect(
      service.create('user-4', {
        programId: 'prog-1',
        programScheduleId: 'sch-1',
        participantCount: 1,
      }),
    ).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
  });

  it('should store programScheduleId on reservation', async () => {
    await service.create('user-1', {
      programId: 'prog-1',
      programScheduleId: 'sch-1',
      participantCount: 1,
    });
    expect(reservations[0].programScheduleId).toBe('sch-1');
  });

  it('should reject if programScheduleId does not belong to programId', async () => {
    schedules.set('sch-other', {
      id: 'sch-other',
      programId: 'prog-other',
      startAt: new Date(),
      capacity: 10,
      status: 'ACTIVE',
    });

    await expect(
      service.create('user-1', {
        programId: 'prog-1',
        programScheduleId: 'sch-other',
        participantCount: 1,
      }),
    ).rejects.toMatchObject({ code: 'SCHEDULE_NOT_FOUND' });
  });

  it('should require programScheduleId or startAt', async () => {
    await expect(
      service.create('user-1', {
        programId: 'prog-1',
        participantCount: 1,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
