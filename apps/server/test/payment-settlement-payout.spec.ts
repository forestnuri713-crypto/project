import { Prisma } from '@prisma/client';
import { PaymentsService } from '../src/payments/payments.service';
import { PayoutsService } from '../src/payments/payouts.service';
import { BusinessException } from '../src/common/exceptions/business.exception';

describe('PaymentSettlement & Payout', () => {
  // --- Settlement creation via webhook paid ---
  describe('Settlement via webhook', () => {
    let service: PaymentsService;
    let settlementCreated: number;
    let webhookEvents: Map<string, any>;

    beforeEach(() => {
      settlementCreated = 0;
      webhookEvents = new Map();

      const txProxy: any = {
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'pay-1',
            merchantUid: 'merchant-1',
            portonePaymentId: 'portone-1',
            reservationId: 'res-1',
            amount: 10000,
            status: 'PENDING',
            reservation: { id: 'res-1', status: 'PENDING' },
          }),
          update: jest.fn().mockResolvedValue({ id: 'pay-1' }),
        },
        reservation: {
          findUnique: jest.fn().mockResolvedValue({ id: 'res-1', status: 'PENDING' }),
          updateMany: jest.fn().mockImplementation(() => {
            return Promise.resolve({ count: 1 });
          }),
        },
        paymentSettlement: {
          upsert: jest.fn().mockImplementation(() => {
            settlementCreated++;
            return Promise.resolve({ id: 'stl-1' });
          }),
        },
        paymentWebhookEvent: {
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const mockPrisma: any = {
        $transaction: jest.fn((fn: any) => fn(txProxy)),
        paymentWebhookEvent: {
          create: jest.fn().mockImplementation((args: any) => {
            const key = `${args.data.provider}:${args.data.eventKey}`;
            if (webhookEvents.has(key)) {
              const err: any = new Error('P2002');
              err.code = 'P2002';
              return Promise.reject(err);
            }
            webhookEvents.set(key, args.data);
            return Promise.resolve({ id: 'evt-1' });
          }),
        },
      };

      const mockPortone: any = {
        getPaymentDetail: jest.fn().mockResolvedValue({
          amount: { total: 10000 },
          status: 'PAID',
        }),
      };

      const mockConfig: any = { get: jest.fn().mockReturnValue('test') };

      service = new PaymentsService(mockPrisma, mockPortone, mockConfig);
    });

    it('should create settlement on paid confirmation', async () => {
      await service.handleWebhook({
        type: 'paid',
        data: { paymentId: 'portone-1', merchantUid: 'merchant-1', eventId: 'e1' },
      });
      expect(settlementCreated).toBe(1);
    });

    it('should store correct fee policy values (grossAmount=99999)', async () => {
      // Override payment amount to 99999 for fee policy verification
      const upsertSpy = jest.fn().mockResolvedValue({ id: 'stl-fee' });
      const txProxy: any = {
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'pay-fee',
            merchantUid: 'merchant-fee',
            portonePaymentId: 'portone-fee',
            reservationId: 'res-fee',
            amount: 99999,
            status: 'PENDING',
            reservation: { id: 'res-fee', status: 'PENDING' },
          }),
          update: jest.fn().mockResolvedValue({ id: 'pay-fee' }),
        },
        reservation: {
          findUnique: jest.fn().mockResolvedValue({ id: 'res-fee', status: 'PENDING' }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        paymentSettlement: { upsert: upsertSpy },
        paymentWebhookEvent: { update: jest.fn().mockResolvedValue({}) },
      };

      const feePrisma: any = {
        $transaction: jest.fn((fn: any) => fn(txProxy)),
        paymentWebhookEvent: {
          create: jest.fn().mockResolvedValue({ id: 'evt-fee' }),
        },
      };
      const feePortone: any = {
        getPaymentDetail: jest.fn().mockResolvedValue({
          amount: { total: 99999 },
          status: 'PAID',
        }),
      };
      const feeConfig: any = { get: jest.fn().mockReturnValue('test') };
      const feeService = new PaymentsService(feePrisma, feePortone, feeConfig);

      await feeService.handleWebhook({
        type: 'paid',
        data: { paymentId: 'portone-fee', merchantUid: 'merchant-fee', eventId: 'e-fee' },
      });

      expect(upsertSpy).toHaveBeenCalledTimes(1);
      const createArgs = upsertSpy.mock.calls[0][0].create;
      expect(createArgs.grossAmount).toBe(99999);
      expect(createArgs.platformFee).toBe(9999); // Math.floor(99999 * 0.10)
      expect(createArgs.netAmount).toBe(90000); // 99999 - 9999
      expect(createArgs.platformRate).toEqual(new Prisma.Decimal('0.10'));
    });

    it('should not create duplicate settlement on duplicate paid', async () => {
      await service.handleWebhook({
        type: 'paid',
        data: { paymentId: 'portone-1', merchantUid: 'merchant-1', eventId: 'e1' },
      });
      // Second call deduped at event layer
      await service.handleWebhook({
        type: 'paid',
        data: { paymentId: 'portone-1', merchantUid: 'merchant-1', eventId: 'e1' },
      });
      expect(settlementCreated).toBe(1);
    });
  });

  // --- Payout dedup & status transitions ---
  describe('Payout', () => {
    let payoutsService: PayoutsService;
    let settlementStatus: string;
    let payoutKeys: Set<string>;

    beforeEach(() => {
      settlementStatus = 'PENDING';
      payoutKeys = new Set();

      const mockPrisma: any = {
        paymentSettlement: {
          findUnique: jest.fn().mockImplementation(() =>
            Promise.resolve({
              id: 'stl-1',
              netAmount: 9000,
              status: settlementStatus,
            }),
          ),
        },
        $transaction: jest.fn(async (fn: any) => {
          const txProxy: any = {
            payout: {
              create: jest.fn().mockImplementation((args: any) => {
                if (payoutKeys.has(args.data.payoutKey)) {
                  const err: any = new Error('P2002');
                  err.code = 'P2002';
                  throw err;
                }
                payoutKeys.add(args.data.payoutKey);
                return Promise.resolve({ id: 'po-1', ...args.data });
              }),
              update: jest.fn().mockResolvedValue({ id: 'po-1' }),
            },
            paymentSettlement: {
              update: jest.fn().mockImplementation((args: any) => {
                if (args.data.status) settlementStatus = args.data.status;
                return Promise.resolve({ id: 'stl-1' });
              }),
            },
          };
          return fn(txProxy);
        }),
      };

      payoutsService = new PayoutsService(mockPrisma);
    });

    it('should execute payout and set settlement to PAID', async () => {
      await payoutsService.executePayout('stl-1');
      expect(settlementStatus).toBe('PAID');
    });

    it('should reject payout if settlement already PAID', async () => {
      settlementStatus = 'PAID';
      await expect(payoutsService.executePayout('stl-1')).rejects.toMatchObject({
        code: 'SETTLEMENT_ALREADY_PAID',
      });
    });

    it('should handle settlement status transitions correctly', async () => {
      expect(settlementStatus).toBe('PENDING');
      await payoutsService.executePayout('stl-1');
      expect(settlementStatus).toBe('PAID');
    });
  });

  // --- Weekly batch payout ---
  describe('Weekly batch payout', () => {
    let payoutsService: PayoutsService;
    let settlementStatuses: Map<string, string>;
    let payoutKeys: Set<string>;

    beforeEach(() => {
      settlementStatuses = new Map([
        ['stl-1', 'CONFIRMED'],
        ['stl-2', 'CONFIRMED'],
        ['stl-3', 'CONFIRMED'],
      ]);
      payoutKeys = new Set();

      const mockPrisma: any = {
        paymentSettlement: {
          findMany: jest.fn().mockImplementation(() =>
            Promise.resolve(
              Array.from(settlementStatuses.entries())
                .filter(([, status]) => status === 'CONFIRMED')
                .map(([id]) => ({ id, netAmount: 9000, status: 'CONFIRMED' })),
            ),
          ),
        },
        $transaction: jest.fn(async (fn: any) => {
          const txProxy: any = {
            payout: {
              create: jest.fn().mockImplementation((args: any) => {
                if (payoutKeys.has(args.data.payoutKey)) {
                  const err: any = new Error('P2002');
                  err.code = 'P2002';
                  throw err;
                }
                payoutKeys.add(args.data.payoutKey);
                return Promise.resolve({ id: `po-${args.data.settlementId}`, ...args.data });
              }),
              update: jest.fn().mockResolvedValue({}),
            },
            paymentSettlement: {
              update: jest.fn().mockImplementation((args: any) => {
                if (args.data.status) {
                  settlementStatuses.set(args.where.id, args.data.status);
                }
                return Promise.resolve({ id: args.where.id });
              }),
            },
          };
          return fn(txProxy);
        }),
      };

      payoutsService = new PayoutsService(mockPrisma);
    });

    it('should process all CONFIRMED settlements in batch', async () => {
      const results = await payoutsService.executeWeeklyPayout(7);
      expect(results).toHaveLength(3);
      expect(results.every((r: any) => r.status === 'SUCCESS')).toBe(true);
      expect(settlementStatuses.get('stl-1')).toBe('PAID');
      expect(settlementStatuses.get('stl-2')).toBe('PAID');
      expect(settlementStatuses.get('stl-3')).toBe('PAID');
    });

    it('should dedup on duplicate weekly payout (same week)', async () => {
      await payoutsService.executeWeeklyPayout(7);
      // Second run with same weekNumber — payoutKeys already exist
      const results = await payoutsService.executeWeeklyPayout(7);
      // findMany returns empty since all are now PAID (filter is CONFIRMED only)
      expect(results).toHaveLength(0);
    });

    it('should return mixed results for partial failures', async () => {
      // Pre-seed one payoutKey to simulate dedup for stl-2
      const { createHash } = require('crypto');
      const dedupKey = createHash('sha256')
        .update('stl-2:week-7')
        .digest('hex');
      payoutKeys.add(dedupKey);

      const results = await payoutsService.executeWeeklyPayout(7);
      expect(results).toHaveLength(3);
      const stl1 = results.find((r: any) => r.settlementId === 'stl-1');
      const stl2 = results.find((r: any) => r.settlementId === 'stl-2');
      const stl3 = results.find((r: any) => r.settlementId === 'stl-3');
      expect(stl1!.status).toBe('SUCCESS');
      expect(stl2!.status).toBe('DEDUP');
      expect(stl3!.status).toBe('SUCCESS');
    });
  });
});
