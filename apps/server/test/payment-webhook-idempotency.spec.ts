import { PaymentsService } from '../src/payments/payments.service';

describe('PaymentsService - webhook idempotency', () => {
  let service: PaymentsService;
  let mockPrisma: any;
  let mockPortone: any;
  let mockConfig: any;

  // In-memory state
  let paymentStatus: string;
  let reservationStatus: string;
  let webhookEvents: Map<string, any>;
  let paidCount: number;
  let confirmedCount: number;

  const MERCHANT_UID = 'sooptalk_res-1_1700000000';

  function makePayload(type: string, overrides: Record<string, any> = {}) {
    return {
      type,
      data: {
        paymentId: 'portone-pay-1',
        merchantUid: MERCHANT_UID,
        ...overrides,
      },
    };
  }

  beforeEach(() => {
    paymentStatus = 'PENDING';
    reservationStatus = 'PENDING';
    webhookEvents = new Map();
    paidCount = 0;
    confirmedCount = 0;

    const txProxy: any = {
      payment: {
        findUnique: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: 'pay-1',
            merchantUid: MERCHANT_UID,
            portonePaymentId: 'portone-pay-1',
            reservationId: 'res-1',
            amount: 10000,
            status: paymentStatus,
            reservation: { id: 'res-1', status: reservationStatus },
          }),
        ),
        update: jest.fn().mockImplementation((args: any) => {
          if (args.data.status === 'PAID') {
            paymentStatus = 'PAID';
            paidCount++;
          } else if (args.data.status === 'FAILED') {
            paymentStatus = 'FAILED';
          } else if (args.data.status === 'CANCELLED') {
            paymentStatus = 'CANCELLED';
          }
          return Promise.resolve({ ...args.data, id: 'pay-1' });
        }),
      },
      reservation: {
        findUnique: jest.fn().mockImplementation(() =>
          Promise.resolve({ id: 'res-1', status: reservationStatus }),
        ),
        updateMany: jest.fn().mockImplementation((args: any) => {
          const targetStatus = args.data.status;
          if (targetStatus === 'CONFIRMED') {
            // Atomic: only succeed if current status is not CONFIRMED
            if (reservationStatus === 'CONFIRMED') {
              return Promise.resolve({ count: 0 });
            }
            reservationStatus = 'CONFIRMED';
            confirmedCount++;
            return Promise.resolve({ count: 1 });
          }
          if (targetStatus === 'CANCELLED') {
            // Atomic: only succeed if current status is CONFIRMED
            if (reservationStatus !== 'CONFIRMED') {
              return Promise.resolve({ count: 0 });
            }
            reservationStatus = 'CANCELLED';
            return Promise.resolve({ count: 1 });
          }
          return Promise.resolve({ count: 0 });
        }),
      },
      paymentSettlement: {
        upsert: jest.fn().mockResolvedValue({ id: 'stl-1' }),
      },
      paymentWebhookEvent: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    mockPrisma = {
      $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn(txProxy)),
      paymentWebhookEvent: {
        create: jest.fn().mockImplementation((args: any) => {
          const key = `${args.data.provider}:${args.data.eventKey}`;
          if (webhookEvents.has(key)) {
            const err: any = new Error('Unique constraint failed');
            err.code = 'P2002';
            return Promise.reject(err);
          }
          webhookEvents.set(key, args.data);
          return Promise.resolve({ id: 'evt-1', ...args.data });
        }),
      },
    };

    mockPortone = {
      getPaymentDetail: jest.fn().mockResolvedValue({
        amount: { total: 10000 },
        status: 'PAID',
      }),
    };

    mockConfig = {
      get: jest.fn().mockReturnValue('test'),
    };

    service = new PaymentsService(mockPrisma, mockPortone, mockConfig);
  });

  it('should dedup duplicate eventKey — domain updated once', async () => {
    const payload = makePayload('paid', { eventId: 'evt-unique-1' });

    await service.handleWebhook(payload);
    expect(paidCount).toBe(1);
    expect(confirmedCount).toBe(1);

    // Second call with same eventId → dedup
    const result2 = await service.handleWebhook(payload);
    expect(result2).toEqual({ status: 'ok', dedup: true });
    expect(paidCount).toBe(1);
    expect(confirmedCount).toBe(1);
  });

  it('should confirm Payment/Reservation only once on paid twice (updateMany race-safe)', async () => {
    // First paid — updateMany returns count=1, Payment updated
    await service.handleWebhook(makePayload('paid', { eventId: 'evt-a' }));
    expect(paymentStatus).toBe('PAID');
    expect(reservationStatus).toBe('CONFIRMED');
    expect(paidCount).toBe(1);
    expect(confirmedCount).toBe(1);

    // Second paid — updateMany returns count=0, Payment NOT updated again
    await service.handleWebhook(makePayload('paid', { eventId: 'evt-b' }));
    expect(paidCount).toBe(1); // no additional Payment.update
    expect(confirmedCount).toBe(1); // no additional Reservation transition
  });

  it('should end PAID when failed arrives before paid', async () => {
    // Failed first
    await service.handleWebhook(makePayload('failed', { eventId: 'evt-fail' }));
    expect(paymentStatus).toBe('FAILED');

    // Then paid arrives — updateMany succeeds (reservation still PENDING)
    await service.handleWebhook(makePayload('paid', { eventId: 'evt-paid' }));
    expect(paymentStatus).toBe('PAID');
    expect(reservationStatus).toBe('CONFIRMED');
  });

  it('should remain PAID when paid arrives then failed (out-of-order)', async () => {
    // Paid first
    await service.handleWebhook(makePayload('paid', { eventId: 'evt-paid' }));
    expect(paymentStatus).toBe('PAID');

    // Late failed arrives — reservation is CONFIRMED → IGNORED
    await service.handleWebhook(makePayload('failed', { eventId: 'evt-fail-late' }));
    expect(paymentStatus).toBe('PAID'); // unchanged
    expect(reservationStatus).toBe('CONFIRMED'); // unchanged
  });

  it('should handle concurrent paid: updateMany count=1 then count=0', async () => {
    // Simulate two paid events processed sequentially (same merchant, different eventKeys)
    const r1 = service.handleWebhook(makePayload('paid', { eventId: 'evt-c1' }));
    const r2 = service.handleWebhook(makePayload('paid', { eventId: 'evt-c2' }));
    await Promise.all([r1, r2]);

    // Only one Payment PAID write, one Reservation CONFIRMED transition
    expect(paidCount).toBe(1);
    expect(confirmedCount).toBe(1);
    expect(paymentStatus).toBe('PAID');
    expect(reservationStatus).toBe('CONFIRMED');
  });
});
