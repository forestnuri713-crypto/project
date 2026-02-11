import {
  AdminBulkCancelService,
  CreateJobCreatedResult,
  CreateJobDryRunResult,
  StartJobIdempotentResult,
  StartJobResult,
} from '../src/admin/admin-bulk-cancel.service';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentsService } from '../src/payments/payments.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { BulkCancelJobStatus } from '@prisma/client';

// ─── Mock 인터페이스 ────────────────────────────────────

interface MockPrisma {
  program: { findUnique: jest.Mock };
  reservation: { findMany: jest.Mock; update: jest.Mock };
  bulkCancelJob: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  bulkCancelJobItem: {
    findMany: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
}

interface MockPaymentsService {
  processRefund: jest.Mock;
}

interface MockNotificationsService {
  createAndSend: jest.Mock;
}

// ─── 타입 가드 ──────────────────────────────────────────

function isDryRunResult(
  r: CreateJobDryRunResult | CreateJobCreatedResult,
): r is CreateJobDryRunResult {
  return 'dryRun' in r && r.dryRun === true;
}

function isIdempotent(r: StartJobResult): r is StartJobIdempotentResult {
  return 'message' in r;
}

// ─── 테스트 ─────────────────────────────────────────────

describe('AdminBulkCancelService', () => {
  let service: AdminBulkCancelService;
  let mockPrisma: MockPrisma;
  let mockPaymentsService: MockPaymentsService;
  let mockNotificationsService: MockNotificationsService;

  const programId = 'prog-1';
  const adminUserId = 'admin-1';

  const futureSchedule = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    mockPrisma = {
      program: { findUnique: jest.fn() },
      reservation: { findMany: jest.fn(), update: jest.fn() },
      bulkCancelJob: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      bulkCancelJobItem: {
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    mockPaymentsService = {
      processRefund: jest.fn(),
    };

    mockNotificationsService = {
      createAndSend: jest.fn(),
    };

    service = new AdminBulkCancelService(
      mockPrisma as unknown as PrismaService,
      mockPaymentsService as unknown as PaymentsService,
      mockNotificationsService as unknown as NotificationsService,
    );
  });

  describe('createJob', () => {
    it('should throw 404 when program not found', async () => {
      mockPrisma.program.findUnique.mockResolvedValue(null);

      await expect(
        service.createJob(programId, '우천 취소', adminUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw 409 when a RUNNING job already exists', async () => {
      mockPrisma.program.findUnique.mockResolvedValue({ id: programId });
      mockPrisma.bulkCancelJob.findFirst.mockResolvedValue({
        id: 'existing-job',
        status: 'RUNNING',
      });

      await expect(
        service.createJob(programId, '우천 취소', adminUserId),
      ).rejects.toThrow(ConflictException);
    });

    it('should return dry run result without DB changes', async () => {
      mockPrisma.program.findUnique.mockResolvedValue({ id: programId });
      mockPrisma.bulkCancelJob.findFirst.mockResolvedValue(null);
      mockPrisma.reservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          userId: 'user-1',
          totalPrice: 50000,
          program: { scheduleAt: futureSchedule },
          payment: { id: 'pay-1' },
        },
      ]);

      // overload: dryRun=true → CreateJobDryRunResult
      const result = await service.createJob(
        programId,
        '우천 취소',
        adminUserId,
        true,
      );

      expect(result.dryRun).toBe(true);
      expect(result.totalTargets).toBe(1);
      expect(result.estimatedRefunds).toHaveLength(1);
      expect(result.estimatedRefunds[0].estimatedRefund).toBe(50000);
      expect(mockPrisma.bulkCancelJob.create).not.toHaveBeenCalled();
    });

    it('should create job with items', async () => {
      mockPrisma.program.findUnique.mockResolvedValue({ id: programId });
      mockPrisma.bulkCancelJob.findFirst.mockResolvedValue(null);
      mockPrisma.reservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          userId: 'user-1',
          totalPrice: 50000,
          program: { scheduleAt: futureSchedule },
          payment: { id: 'pay-1' },
        },
      ]);
      mockPrisma.bulkCancelJob.create.mockResolvedValue({
        id: 'job-1',
        sessionId: programId,
        status: 'PENDING',
        totalTargets: 1,
        items: [{ id: 'item-1', reservationId: 'res-1' }],
      });

      // overload: dryRun 생략 → CreateJobCreatedResult
      const result = await service.createJob(
        programId,
        '우천 취소',
        adminUserId,
      );

      expect(result.id).toBe('job-1');
      expect(result.totalTargets).toBe(1);
      expect(mockPrisma.bulkCancelJob.create).toHaveBeenCalled();
    });
  });

  describe('startJob', () => {
    it('should throw 404 for non-existent job', async () => {
      mockPrisma.bulkCancelJob.findUnique.mockResolvedValue(null);

      await expect(service.startJob('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw 409 for already COMPLETED job', async () => {
      mockPrisma.bulkCancelJob.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'COMPLETED',
        items: [],
      });

      await expect(service.startJob('job-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should return idempotent response for RUNNING job', async () => {
      mockPrisma.bulkCancelJob.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'RUNNING',
        items: [],
      });

      const result = await service.startJob('job-1');

      expect(isIdempotent(result)).toBe(true);
      if (isIdempotent(result)) {
        expect(result.message).toBe('이미 실행 중입니다');
      }
    });

    it('should skip already CANCELLED reservations', async () => {
      mockPrisma.bulkCancelJob.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'PENDING',
        mode: 'A_PG_REFUND',
        items: [
          {
            id: 'item-1',
            result: 'FAILED',
            reservation: {
              id: 'res-1',
              status: 'CANCELLED',
              totalPrice: 50000,
              userId: 'user-1',
              program: {
                scheduleAt: futureSchedule,
                title: 'Test',
                id: 'prog-1',
              },
              payment: null,
            },
          },
        ],
      });
      mockPrisma.bulkCancelJob.update.mockImplementation(
        (args: { data: Record<string, unknown> }) => ({
          id: 'job-1',
          ...args.data,
        }),
      );
      mockPrisma.bulkCancelJobItem.update.mockResolvedValue({});

      const result = await service.startJob('job-1');

      expect(isIdempotent(result)).toBe(false);
      if (!isIdempotent(result)) {
        expect(result.skippedCount).toBe(1);
        expect(result.successCount).toBe(0);
      }
      expect(mockPaymentsService.processRefund).not.toHaveBeenCalled();
    });

    it('should handle Mode B without PG refund call', async () => {
      const modeB = new AdminBulkCancelService(
        mockPrisma as unknown as PrismaService,
        null,
        mockNotificationsService as unknown as NotificationsService,
      );

      mockPrisma.bulkCancelJob.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'PENDING',
        mode: 'B_LEDGER_ONLY',
        items: [
          {
            id: 'item-1',
            result: 'FAILED',
            reservation: {
              id: 'res-1',
              status: 'CONFIRMED',
              totalPrice: 50000,
              userId: 'user-1',
              program: {
                scheduleAt: futureSchedule,
                title: 'Test',
                id: 'prog-1',
              },
              payment: { id: 'pay-1', amount: 50000 },
            },
          },
        ],
      });
      mockPrisma.bulkCancelJob.update.mockImplementation(
        (args: { data: Record<string, unknown> }) => ({
          id: 'job-1',
          ...args.data,
        }),
      );
      mockPrisma.bulkCancelJobItem.update.mockResolvedValue({});
      mockPrisma.reservation.update.mockResolvedValue({});
      mockNotificationsService.createAndSend.mockResolvedValue({});

      const result = await modeB.startJob('job-1');

      expect(isIdempotent(result)).toBe(false);
      if (!isIdempotent(result)) {
        expect(result.successCount).toBe(1);
      }
    });

    it('should mark COMPLETED_WITH_ERRORS when PG refund fails for some items', async () => {
      mockPrisma.bulkCancelJob.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'PENDING',
        mode: 'A_PG_REFUND',
        items: [
          {
            id: 'item-1',
            result: 'FAILED',
            reservation: {
              id: 'res-1',
              status: 'CONFIRMED',
              totalPrice: 50000,
              userId: 'user-1',
              program: {
                scheduleAt: futureSchedule,
                title: 'Test',
                id: 'prog-1',
              },
              payment: { id: 'pay-1', amount: 50000 },
            },
          },
          {
            id: 'item-2',
            result: 'FAILED',
            reservation: {
              id: 'res-2',
              status: 'CONFIRMED',
              totalPrice: 30000,
              userId: 'user-2',
              program: {
                scheduleAt: futureSchedule,
                title: 'Test',
                id: 'prog-1',
              },
              payment: { id: 'pay-2', amount: 30000 },
            },
          },
        ],
      });

      mockPaymentsService.processRefund
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('PG 오류'));

      mockPrisma.bulkCancelJob.update.mockImplementation(
        (args: { data: Record<string, unknown> }) => ({
          id: 'job-1',
          ...args.data,
        }),
      );
      mockPrisma.bulkCancelJobItem.update.mockResolvedValue({});
      mockPrisma.reservation.update.mockResolvedValue({});
      mockNotificationsService.createAndSend.mockResolvedValue({});

      const result = await service.startJob('job-1');

      expect(isIdempotent(result)).toBe(false);
      if (!isIdempotent(result)) {
        expect(result.status).toBe<BulkCancelJobStatus>(
          'COMPLETED_WITH_ERRORS',
        );
        expect(result.successCount).toBe(1);
        expect(result.failedCount).toBe(1);
      }
    });
  });

  describe('getJobItems', () => {
    it('should return paginated items', async () => {
      mockPrisma.bulkCancelJob.findUnique.mockResolvedValue({ id: 'job-1' });
      mockPrisma.bulkCancelJobItem.findMany.mockResolvedValue([
        { id: 'item-1', result: 'SUCCESS' },
        { id: 'item-2', result: 'FAILED' },
      ]);
      mockPrisma.bulkCancelJobItem.count.mockResolvedValue(2);

      const result = await service.getJobItems('job-1', 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by result status', async () => {
      mockPrisma.bulkCancelJob.findUnique.mockResolvedValue({ id: 'job-1' });
      mockPrisma.bulkCancelJobItem.findMany.mockResolvedValue([
        { id: 'item-2', result: 'FAILED' },
      ]);
      mockPrisma.bulkCancelJobItem.count.mockResolvedValue(1);

      const result = await service.getJobItems('job-1', 1, 20, 'FAILED');

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should throw 404 for non-existent job', async () => {
      mockPrisma.bulkCancelJob.findUnique.mockResolvedValue(null);

      await expect(service.getJobItems('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRefundMode', () => {
    it('should return A_PG_REFUND when paymentsService has processRefund', () => {
      const result = service.getRefundMode();
      expect(result.mode).toBe('A_PG_REFUND');
    });

    it('should return B_LEDGER_ONLY when paymentsService is null', () => {
      const svc = new AdminBulkCancelService(
        mockPrisma as unknown as PrismaService,
        null,
        mockNotificationsService as unknown as NotificationsService,
      );
      const result = svc.getRefundMode();
      expect(result.mode).toBe('B_LEDGER_ONLY');
    });
  });
});
