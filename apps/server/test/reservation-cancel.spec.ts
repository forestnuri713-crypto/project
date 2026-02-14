import { ReservationsService } from '../src/reservations/reservations.service';

describe('ReservationsService - cancel', () => {
  let service: ReservationsService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockPayments: any;

  let reservedCount: number;
  const maxCapacity = 10;

  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead

  function makeReservation(overrides: Record<string, any> = {}) {
    return {
      id: 'res-1',
      userId: 'user-1',
      programId: 'prog-1',
      participantCount: 2,
      totalPrice: 20000,
      status: 'CONFIRMED',
      program: {
        id: 'prog-1',
        title: 'Test Program',
        scheduleAt: futureDate,
        location: 'Seoul',
        maxCapacity,
        reservedCount,
      },
      payment: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    reservedCount = 4;

    const txProxy: any = {
      reservation: {
        update: jest.fn().mockImplementation((args: any) =>
          Promise.resolve({
            id: args.where.id,
            ...args.data,
            program: { id: 'prog-1', title: 'Test Program', scheduleAt: futureDate },
          }),
        ),
      },
      $executeRaw: jest.fn().mockImplementation((...args: any[]) => {
        const delta = args[1];
        if (typeof delta !== 'number') return Promise.resolve(0);

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
      reservation: {
        findUnique: jest.fn(),
      },
    };

    mockRedis = {
      acquireLock: jest.fn().mockResolvedValue('lock-value'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    mockPayments = {
      processRefund: jest.fn().mockResolvedValue(undefined),
    };

    service = new ReservationsService(mockPrisma, mockRedis, mockPayments);
  });

  it('should cancel and restore capacity', async () => {
    const reservation = makeReservation();
    mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

    const initialCount = reservedCount; // 4
    const result = await service.cancel('res-1', 'user-1');

    expect(result.status).toBe('CANCELLED');
    expect(reservedCount).toBe(initialCount - reservation.participantCount);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should throw RESERVATION_ALREADY_CANCELLED for double cancel', async () => {
    const reservation = makeReservation({ status: 'CANCELLED' });
    mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

    await expect(service.cancel('res-1', 'user-1')).rejects.toMatchObject({
     code: 'RESERVATION_ALREADY_CANCELLED',
    });
  });

  it('should throw RESERVATION_COMPLETED for completed reservation', async () => {
    const reservation = makeReservation({ status: 'COMPLETED' });
    mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

    await expect(service.cancel('res-1', 'user-1')).rejects.toMatchObject({
     code: 'RESERVATION_COMPLETED',
    });
  });

  it('should throw INVARIANT_VIOLATION when decrement goes below zero', async () => {
    // Set reservedCount to 0 so decrement will fail
    reservedCount = 0;
    const reservation = makeReservation({ participantCount: 2 });
    mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

    await expect(service.cancel('res-1', 'user-1')).rejects.toMatchObject({
     code: 'INVARIANT_VIOLATION',
    });
  });

  it('should throw RESERVATION_NOT_FOUND for non-existent reservation', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(null);

    await expect(service.cancel('res-999', 'user-1')).rejects.toMatchObject({
      code: 'RESERVATION_NOT_FOUND',
    });
  });

  it('should throw RESERVATION_FORBIDDEN when cancelling another user reservation', async () => {
    const reservation = makeReservation({ userId: 'user-other' });
    mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

    await expect(service.cancel('res-1', 'user-1')).rejects.toMatchObject({
      code: 'RESERVATION_FORBIDDEN',
    });
  });

  it('should call processRefund when payment exists and refund > 0', async () => {
    const reservation = makeReservation({
      payment: { id: 'pay-1', amount: 20000, portonePaymentId: 'port-1' },
    });
    mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

    await service.cancel('res-1', 'user-1');

    expect(mockPayments.processRefund).toHaveBeenCalledWith('res-1', expect.any(Number));
  });

  it('should NOT call processRefund when no payment', async () => {
    const reservation = makeReservation({ payment: null });
    mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

    await service.cancel('res-1', 'user-1');

    expect(mockPayments.processRefund).not.toHaveBeenCalled();
  });

  it('should return refundRatio and refundAmount in result', async () => {
    const reservation = makeReservation();
    mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

    const result = await service.cancel('res-1', 'user-1');

    expect(result).toHaveProperty('refundRatio');
    expect(result).toHaveProperty('refundAmount');
    expect(typeof result.refundRatio).toBe('number');
    expect(typeof result.refundAmount).toBe('number');
  });
});
