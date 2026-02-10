import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PLATFORM_FEE_RATE,
  DEFAULT_B2B_COMMISSION_RATE,
} from '@sooptalk/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GenerateSettlementDto } from './dto/generate-settlement.dto';
import { QuerySettlementDto } from './dto/query-settlement.dto';
import { UpdateSettlementDto } from './dto/update-settlement.dto';

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async generateSettlements(dto: GenerateSettlementDto) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    // Find all instructors who had payments in this period
    const instructors = await this.prisma.user.findMany({
      where: { role: 'INSTRUCTOR' },
      select: { id: true },
    });

    const created: string[] = [];

    for (const instructor of instructors) {
      try {
        const settlement = await this.createSettlementForInstructor(
          instructor.id,
          periodStart,
          periodEnd,
        );
        if (settlement) {
          created.push(settlement.id);

          // Send notification to instructor
          await this.notificationsService.createAndSend(
            instructor.id,
            'SETTLEMENT_CREATED',
            '정산 생성 알림',
            `${periodStart.toLocaleDateString('ko-KR')} ~ ${periodEnd.toLocaleDateString('ko-KR')} 기간 정산이 생성되었습니다.`,
            { settlementId: settlement.id },
          );
        }
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          this.logger.warn(
            `이미 존재하는 정산: instructorId=${instructor.id}, period=${dto.periodStart}~${dto.periodEnd}`,
          );
          continue;
        }
        this.logger.error(
          `정산 생성 실패: instructorId=${instructor.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(`정산 생성 완료: ${created.length}건`);
    return { created: created.length, settlementIds: created };
  }

  private async createSettlementForInstructor(
    instructorId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    // Gross amount: sum of PAID payments for this instructor's programs in the period
    const grossResult = await this.prisma.payment.aggregate({
      where: {
        status: 'PAID',
        paidAt: { gte: periodStart, lte: periodEnd },
        reservation: {
          program: { instructorId },
        },
      },
      _sum: { amount: true },
    });
    const grossAmount = grossResult._sum.amount ?? 0;

    // Refund amount: sum of refunded amounts in the period
    const refundResult = await this.prisma.payment.aggregate({
      where: {
        refundedAt: { gte: periodStart, lte: periodEnd },
        reservation: {
          program: { instructorId },
        },
      },
      _sum: { refundedAmount: true },
    });
    const refundAmount = refundResult._sum.refundedAmount ?? 0;

    // Notification cost: 0 (prepaid cash system — deducted at send time, no double deduction in settlement)
    const notificationCost = 0;

    // B2B commission: sum of B2B program payments * 5%
    const b2bResult = await this.prisma.payment.aggregate({
      where: {
        status: 'PAID',
        paidAt: { gte: periodStart, lte: periodEnd },
        reservation: {
          program: { instructorId, isB2b: true },
        },
      },
      _sum: { amount: true },
    });
    const b2bCommission = Math.round(
      (b2bResult._sum.amount ?? 0) * DEFAULT_B2B_COMMISSION_RATE,
    );

    // Platform fee: (grossAmount - refundAmount) * 10%
    const platformFee = Math.round((grossAmount - refundAmount) * PLATFORM_FEE_RATE);

    // Net amount
    const netAmount =
      grossAmount - refundAmount - platformFee - notificationCost - b2bCommission;

    // Skip if no revenue at all
    if (grossAmount === 0 && refundAmount === 0) {
      return null;
    }

    return this.prisma.settlement.create({
      data: {
        instructorId,
        periodStart,
        periodEnd,
        grossAmount,
        refundAmount,
        platformFee,
        notificationCost,
        b2bCommission,
        netAmount,
      },
    });
  }

  async findAll(query: QuerySettlementDto) {
    const where: Prisma.SettlementWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        include: {
          instructor: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
      include: {
        instructor: { select: { id: true, name: true, email: true, phoneNumber: true } },
      },
    });

    if (!settlement) {
      throw new NotFoundException('정산을 찾을 수 없습니다');
    }

    return settlement;
  }

  async confirm(id: string) {
    const settlement = await this.findOne(id);

    if (settlement.status !== 'PENDING') {
      throw new BadRequestException('PENDING 상태의 정산만 확인 처리할 수 있습니다');
    }

    return this.prisma.settlement.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });
  }

  async markAsPaid(id: string) {
    const settlement = await this.findOne(id);

    if (settlement.status !== 'CONFIRMED') {
      throw new BadRequestException('CONFIRMED 상태의 정산만 지급 완료 처리할 수 있습니다');
    }

    return this.prisma.settlement.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  async update(id: string, dto: UpdateSettlementDto) {
    await this.findOne(id);

    return this.prisma.settlement.update({
      where: { id },
      data: { memo: dto.memo },
    });
  }

  async findByInstructor(instructorId: string, query: QuerySettlementDto) {
    const where: Prisma.SettlementWhereInput = { instructorId };
    if (query.status) {
      where.status = query.status;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
