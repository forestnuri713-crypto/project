import {
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  BulkCancelItemResult,
  BulkCancelJob,
  BulkCancelJobItem,
  BulkCancelJobStatus,
} from '@prisma/client';
import { REFUND_POLICY } from '@sooptalk/shared';
import { BusinessException } from '../common/exceptions/business.exception';
import { shouldSkipBulkCancel } from '../domain/reservation.util';
import { BulkCancelMode, getRefundMode } from '../domain/refund.util';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';

// ─── Return Types ─────────────────────────────────────

export { BulkCancelMode } from '../domain/refund.util';

export interface CreateJobDryRunResult {
  dryRun: true;
  mode: BulkCancelMode;
  sessionId: string;
  totalTargets: number;
  estimatedRefunds: {
    reservationId: string;
    userId: string;
    totalPrice: number;
    estimatedRefund: number;
  }[];
}

export type CreateJobCreatedResult = BulkCancelJob & {
  items: BulkCancelJobItem[];
};

export interface StartJobIdempotentResult {
  message: string;
  jobId: string;
}

export type StartJobResult = StartJobIdempotentResult | BulkCancelJob;

export type RetryFailedResult = StartJobIdempotentResult | BulkCancelJob;

// ─── processItem 내부 파라미터 타입 ─────────────────────

interface ProcessItemInput {
  id: string;
  result: BulkCancelItemResult;
  reservation: {
    id: string;
    status: string;
    totalPrice: number;
    participantCount: number;
    userId: string;
    program: { scheduleAt: Date; title: string; id: string };
    payment: {
      id: string;
      amount: number;
      refundedAmount: number;
      portonePaymentId: string;
    } | null;
  };
}

// ─── Service ──────────────────────────────────────────

@Injectable()
export class AdminBulkCancelService {
  private readonly logger = new Logger(AdminBulkCancelService.name);

  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService | null,
    private notificationsService: NotificationsService,
  ) {}

  private determineMode(): BulkCancelMode {
    const paymentsServicePresent =
      !!this.paymentsService &&
      typeof this.paymentsService.processRefund === 'function';
    return getRefundMode(paymentsServicePresent);
  }

  async createJob(
    sessionId: string,
    reason: string,
    adminUserId: string,
    dryRun: true,
  ): Promise<CreateJobDryRunResult>;
  async createJob(
    sessionId: string,
    reason: string,
    adminUserId: string,
    dryRun?: false,
  ): Promise<CreateJobCreatedResult>;
  async createJob(
    sessionId: string,
    reason: string,
    adminUserId: string,
    dryRun?: boolean,
  ): Promise<CreateJobDryRunResult | CreateJobCreatedResult>;
  async createJob(
    sessionId: string,
    reason: string,
    adminUserId: string,
    dryRun = false,
  ): Promise<CreateJobDryRunResult | CreateJobCreatedResult> {
    const program = await this.prisma.program.findUnique({
      where: { id: sessionId },
    });
    if (!program) {
      throw new BusinessException(
        'BULK_CANCEL_JOB_NOT_FOUND',
        '프로그램을 찾을 수 없습니다',
        404,
      );
    }

    const runningJob = await this.prisma.bulkCancelJob.findFirst({
      where: { sessionId, status: 'RUNNING' },
    });
    if (runningJob) {
      throw new BusinessException(
        'BULK_CANCEL_JOB_RUNNING',
        '해당 프로그램에 이미 실행 중인 일괄 취소 작업이 있습니다',
        409,
      );
    }

    const targetReservations = await this.prisma.reservation.findMany({
      where: {
        programId: sessionId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { payment: true, program: true },
    });

    const mode = this.determineMode();

    if (dryRun) {
      const estimatedRefunds = targetReservations.map((r) => {
        const refundAmount = this.calculateRefundAmount(
          r.totalPrice,
          r.program.scheduleAt,
        );
        return {
          reservationId: r.id,
          userId: r.userId,
          totalPrice: r.totalPrice,
          estimatedRefund: refundAmount,
        };
      });

      return {
        dryRun: true as const,
        mode,
        sessionId,
        totalTargets: targetReservations.length,
        estimatedRefunds,
      };
    }

    return this.prisma.bulkCancelJob.create({
      data: {
        sessionId,
        reason,
        mode,
        status: 'PENDING',
        totalTargets: targetReservations.length,
        createdByAdminUserId: adminUserId,
        items: {
          create: targetReservations.map((r) => ({
            reservationId: r.id,
            result: 'FAILED' as BulkCancelItemResult,
            notificationSent: false,
          })),
        },
      },
      include: { items: true },
    });
  }

  async startJob(jobId: string): Promise<StartJobResult> {
    const job = await this.prisma.bulkCancelJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          include: {
            reservation: { include: { payment: true, program: true } },
          },
        },
      },
    });

    if (!job) {
      throw new BusinessException(
        'BULK_CANCEL_JOB_NOT_FOUND',
        '일괄 취소 작업을 찾을 수 없습니다',
        404,
      );
    }

    if (
      job.status === 'COMPLETED' ||
      job.status === 'COMPLETED_WITH_ERRORS' ||
      job.status === 'FAILED'
    ) {
      throw new BusinessException(
        'BULK_CANCEL_JOB_COMPLETED',
        '이미 완료된 작업입니다',
        409,
      );
    }

    if (job.status === 'RUNNING') {
      return { message: '이미 실행 중입니다', jobId: job.id };
    }

    await this.prisma.bulkCancelJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const item of job.items) {
      const result = await this.processItem(item, job.mode);
      if (result === 'SUCCESS') successCount++;
      else if (result === 'FAILED') failedCount++;
      else if (result === 'SKIPPED') skippedCount++;
    }

    const finalStatus = this.deriveFinalStatus(
      successCount,
      failedCount,
      skippedCount,
    );

    return this.prisma.bulkCancelJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        successCount,
        failedCount,
        skippedCount,
        finishedAt: new Date(),
      },
    });
  }

  private async processItem(
    item: ProcessItemInput,
    mode: string,
  ): Promise<BulkCancelItemResult> {
    if (item.result === 'SUCCESS') {
      return 'SKIPPED';
    }

    const reservation = item.reservation;

    if (shouldSkipBulkCancel(reservation)) {
      await this.prisma.bulkCancelJobItem.update({
        where: { id: item.id },
        data: { result: 'SKIPPED', attemptedAt: new Date() },
      });
      return 'SKIPPED';
    }

    const refundAmount = this.calculateRefundAmount(
      reservation.totalPrice,
      reservation.program.scheduleAt,
    );

    try {
      if (
        mode === 'A_PG_REFUND' &&
        reservation.payment &&
        refundAmount > 0 &&
        this.paymentsService
      ) {
        await this.paymentsService.processRefund(reservation.id, refundAmount);
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: 'CANCELLED' },
        });

        // Atomic decrement: restore capacity for cancelled reservation
        await tx.$executeRaw`
          UPDATE "programs"
          SET "reserved_count" = "reserved_count" - ${reservation.participantCount}
          WHERE "id" = ${reservation.program.id}
            AND "reserved_count" - ${reservation.participantCount} >= 0
        `;
      });

      let notificationSent = false;
      try {
        await this.notificationsService.createAndSend(
          reservation.userId,
          'RESERVATION_BULK_CANCELLED',
          '예약 일괄 취소 안내',
          `[${reservation.program.title}] 프로그램이 우천 등의 사유로 취소되었습니다. 환불 예정 금액: ${refundAmount}원`,
          {
            programId: reservation.program.id,
            reservationId: reservation.id,
          },
        );
        notificationSent = true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(
          `알림 발송 실패: reservationId=${reservation.id}, error=${msg}`,
        );
      }

      await this.prisma.bulkCancelJobItem.update({
        where: { id: item.id },
        data: {
          result: 'SUCCESS',
          refundedAmount: refundAmount,
          notificationSent,
          attemptedAt: new Date(),
        },
      });

      return 'SUCCESS';
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      this.logger.warn(
        `예약 취소 실패: reservationId=${reservation.id}, error=${err.message}`,
      );

      await this.prisma.bulkCancelJobItem.update({
        where: { id: item.id },
        data: {
          result: 'FAILED',
          failureCode: err.constructor.name,
          failureMessage: err.message,
          attemptedAt: new Date(),
        },
      });

      return 'FAILED';
    }
  }

  private calculateRefundAmount(
    totalPrice: number,
    scheduleAt: Date,
  ): number {
    const now = new Date();
    const diffMs = scheduleAt.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    let refundRatio: number;
    if (diffDays >= 2) {
      refundRatio = REFUND_POLICY.DAYS_BEFORE_2;
    } else if (diffDays >= 1) {
      refundRatio = REFUND_POLICY.DAYS_BEFORE_1;
    } else {
      refundRatio = REFUND_POLICY.SAME_DAY;
    }

    return Math.floor(totalPrice * refundRatio);
  }

  private deriveFinalStatus(
    successCount: number,
    failedCount: number,
    skippedCount: number,
  ): BulkCancelJobStatus {
    if (failedCount === 0) return 'COMPLETED';
    if (successCount > 0 || skippedCount > 0) return 'COMPLETED_WITH_ERRORS';
    return 'FAILED';
  }

  async getJobSummary(jobId: string) {
    const job = await this.prisma.bulkCancelJob.findUnique({
      where: { id: jobId },
      include: {
        program: { select: { id: true, title: true, scheduleAt: true } },
      },
    });

    if (!job) {
      throw new BusinessException(
        'BULK_CANCEL_JOB_NOT_FOUND',
        '일괄 취소 작업을 찾을 수 없습니다',
        404,
      );
    }

    return job;
  }

  async getJobItems(
    jobId: string,
    page = 1,
    limit = 20,
    result?: BulkCancelItemResult,
  ) {
    const job = await this.prisma.bulkCancelJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new BusinessException(
        'BULK_CANCEL_JOB_NOT_FOUND',
        '일괄 취소 작업을 찾을 수 없습니다',
        404,
      );
    }

    const where: { jobId: string; result?: BulkCancelItemResult } = { jobId };
    if (result) {
      where.result = result;
    }

    const [items, total] = await Promise.all([
      this.prisma.bulkCancelJobItem.findMany({
        where,
        include: {
          reservation: {
            select: {
              id: true,
              userId: true,
              totalPrice: true,
              status: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { attemptedAt: 'desc' },
      }),
      this.prisma.bulkCancelJobItem.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async retryFailed(jobId: string): Promise<RetryFailedResult> {
    const job = await this.prisma.bulkCancelJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          where: { result: 'FAILED' },
          include: {
            reservation: { include: { payment: true, program: true } },
          },
        },
      },
    });

    if (!job) {
      throw new BusinessException(
        'BULK_CANCEL_JOB_NOT_FOUND',
        '일괄 취소 작업을 찾을 수 없습니다',
        404,
      );
    }

    if (job.items.length === 0) {
      return { message: '재시도할 실패 항목이 없습니다', jobId: job.id };
    }

    await this.prisma.bulkCancelJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date(), finishedAt: null },
    });

    let successCount = job.successCount;
    let failedCount = 0;
    const skippedCount = job.skippedCount;

    for (const item of job.items) {
      const result = await this.processItem(item, job.mode);
      if (result === 'SUCCESS') successCount++;
      else if (result === 'FAILED') failedCount++;
    }

    const finalStatus = this.deriveFinalStatus(
      successCount,
      failedCount,
      skippedCount,
    );

    return this.prisma.bulkCancelJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        successCount,
        failedCount,
        skippedCount,
        finishedAt: new Date(),
      },
    });
  }

  getRefundMode(): { mode: BulkCancelMode } {
    return { mode: this.determineMode() };
  }
}
