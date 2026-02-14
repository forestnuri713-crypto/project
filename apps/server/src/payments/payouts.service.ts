import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(private prisma: PrismaService) {}

  async executePayout(settlementId: string) {
    const settlement = await this.prisma.paymentSettlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new NotFoundException('정산 정보를 찾을 수 없습니다');
    }

    if (settlement.status === 'PAID') {
      throw new BusinessException(
        'SETTLEMENT_ALREADY_PAID',
        '이미 지급 완료된 정산입니다',
        400,
      );
    }

    const payoutKey = createHash('sha256')
      .update(`${settlementId}:${Date.now()}`)
      .digest('hex');

    try {
      const payout = await this.prisma.$transaction(async (tx) => {
        const created = await tx.payout.create({
          data: {
            settlementId,
            payoutKey,
            amount: settlement.netAmount,
            status: 'INITIATED',
          },
        });

        // Simulate transfer (replace with real bank API)
        this.logger.log(
          JSON.stringify({
            msg: 'payout_initiated',
            payoutKey,
            settlementId,
            amount: settlement.netAmount,
          }),
        );

        await tx.payout.update({
          where: { id: created.id },
          data: { status: 'SUCCESS', executedAt: new Date() },
        });

        await tx.paymentSettlement.update({
          where: { id: settlementId },
          data: { status: 'PAID', confirmedAt: new Date() },
        });

        return created;
      });

      this.logger.log(
        JSON.stringify({
          msg: 'payout_success',
          payoutKey,
          settlementId,
          payoutId: payout.id,
        }),
      );

      return payout;
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === 'P2002') {
        this.logger.log(
          JSON.stringify({
            msg: 'payout_dedup',
            payoutKey,
            settlementId,
            reason: 'duplicate_payout_key',
          }),
        );
        return { dedup: true, settlementId };
      }
      throw err;
    }
  }

  async executeWeeklyPayout(weekNumber: number) {
    const settlements = await this.prisma.paymentSettlement.findMany({
      where: { status: 'CONFIRMED' },
    });

    const results: Array<{
      settlementId: string;
      status: 'SUCCESS' | 'DEDUP' | 'FAILED';
      payoutId?: string;
      error?: string;
    }> = [];

    for (const settlement of settlements) {
      const payoutKey = createHash('sha256')
        .update(`${settlement.id}:week-${weekNumber}`)
        .digest('hex');

      try {
        const payout = await this.prisma.$transaction(async (tx) => {
          const created = await tx.payout.create({
            data: {
              settlementId: settlement.id,
              payoutKey,
              amount: settlement.netAmount,
              status: 'INITIATED',
            },
          });

          await tx.payout.update({
            where: { id: created.id },
            data: { status: 'SUCCESS', executedAt: new Date() },
          });

          await tx.paymentSettlement.update({
            where: { id: settlement.id },
            data: { status: 'PAID', confirmedAt: new Date() },
          });

          return created;
        });

        results.push({
          settlementId: settlement.id,
          status: 'SUCCESS',
          payoutId: payout.id,
        });
      } catch (err: unknown) {
        const prismaErr = err as { code?: string };
        if (prismaErr.code === 'P2002') {
          results.push({ settlementId: settlement.id, status: 'DEDUP' });
        } else {
          results.push({
            settlementId: settlement.id,
            status: 'FAILED',
            error: String(err),
          });
        }
      }
    }

    this.logger.log(
      JSON.stringify({
        msg: 'weekly_payout_complete',
        weekNumber,
        count: results.length,
      }),
    );

    return results;
  }
}
