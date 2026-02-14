import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PortoneService } from './portone.service';
import { PreparePaymentDto } from './dto/prepare-payment.dto';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private portoneService: PortoneService,
    private configService: ConfigService,
  ) {}

  async preparePayment(userId: string, dto: PreparePaymentDto) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
      include: {
        payment: true,
        program: { select: { id: true, title: true } },
      },
    });

    if (!reservation) {
      throw new NotFoundException('예약을 찾을 수 없습니다');
    }

    if (reservation.userId !== userId) {
      throw new ForbiddenException('본인의 예약만 결제할 수 있습니다');
    }

    if (reservation.status !== 'PENDING') {
      throw new BadRequestException('PENDING 상태의 예약만 결제할 수 있습니다');
    }

    if (reservation.payment) {
      throw new BadRequestException('이미 결제 정보가 존재합니다');
    }

    const portonePaymentId = `sooptalk_${reservation.id}_${Date.now()}`;
    const merchantUid = portonePaymentId;

    await this.prisma.payment.create({
      data: {
        reservationId: reservation.id,
        merchantUid,
        method: dto.method,
        portonePaymentId,
        amount: reservation.totalPrice,
        status: 'PENDING',
      },
    });

    await this.portoneService.preRegister(portonePaymentId, reservation.totalPrice);

    return {
      paymentId: portonePaymentId,
      merchantUid,
      storeId: this.configService.get<string>('PORTONE_STORE_ID'),
      channelKey: this.configService.get<string>('PORTONE_CHANNEL_KEY'),
      amount: reservation.totalPrice,
      orderName: reservation.program.title,
    };
  }

  private computeEventKey(
    eventId: string | undefined,
    eventType: string,
    merchantUid: string,
    providerPaymentId: string,
  ): string {
    if (eventId) return eventId;
    const raw = `PORTONE:${eventType}:${merchantUid}:${providerPaymentId}`;
    return createHash('sha256').update(raw).digest('hex');
  }

  async handleWebhook(payload: WebhookPayloadDto) {
    const eventType = payload.type;
    const providerPaymentId = payload.data.paymentId;
    const merchantUid = payload.data.merchantUid ?? providerPaymentId;
    const eventKey = this.computeEventKey(
      payload.data.eventId,
      eventType,
      merchantUid,
      providerPaymentId,
    );

    this.logger.log(
      JSON.stringify({
        msg: 'webhook_received',
        eventKey,
        merchantUid,
        eventType,
      }),
    );

    // Layer A: event dedup — try insert, unique conflict = already processed
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: {
          provider: 'PORTONE',
          eventKey,
          merchantUid,
          eventType,
          status: 'RECEIVED',
          rawBody: payload as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === 'P2002') {
        this.logger.log(
          JSON.stringify({
            msg: 'webhook_dedup',
            eventKey,
            merchantUid,
            eventType,
            result: 'IGNORED',
            reason: 'duplicate_event_key',
          }),
        );
        return { status: 'ok', dedup: true };
      }
      throw err;
    }

    // Layer B: domain idempotency within transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { merchantUid },
        include: { reservation: true },
      });

      if (!payment) {
        this.logger.warn(
          JSON.stringify({
            msg: 'webhook_no_payment',
            eventKey,
            merchantUid,
            eventType,
            result: 'FAILED',
            reason: 'payment_not_found',
          }),
        );
        await tx.paymentWebhookEvent.update({
          where: { provider_eventKey: { provider: 'PORTONE', eventKey } },
          data: { status: 'FAILED', processedAt: new Date() },
        });
        return { result: 'FAILED' as const, reason: 'payment_not_found' };
      }

      const reservationId = payment.reservationId;

      let webhookResult: 'PROCESSED' | 'IGNORED' | 'FAILED' = 'PROCESSED';
      let reason = '';

      switch (eventType) {
        case 'paid': {
          // Verify with PortOne
          const portoneDetail = await this.portoneService.getPaymentDetail(providerPaymentId);
          const paidAmount = portoneDetail?.amount?.total;
          if (paidAmount !== payment.amount) {
            webhookResult = 'FAILED';
            reason = `amount_mismatch: expected=${payment.amount} got=${paidAmount}`;
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: 'FAILED', failedAt: new Date() },
            });
          } else {
            // Atomic: only transitions if not yet CONFIRMED
            const confirmRes = await tx.reservation.updateMany({
              where: { id: reservationId, status: { not: 'CONFIRMED' } },
              data: { status: 'CONFIRMED' },
            });
            if (confirmRes.count === 0) {
              webhookResult = 'IGNORED';
              reason = 'reservation_already_confirmed';
            } else {
              await tx.payment.update({
                where: { id: payment.id },
                data: { status: 'PAID', paidAt: new Date() },
              });

              // Create settlement record (idempotent by reservationId unique)
              const grossAmount = payment.amount;
              const platformFee = Math.floor(grossAmount * 0.10);
              const netAmount = grossAmount - platformFee;
              await tx.paymentSettlement.upsert({
                where: { reservationId },
                create: {
                  reservationId,
                  paymentId: payment.id,
                  grossAmount,
                  platformRate: new Prisma.Decimal('0.10'),
                  platformFee,
                  netAmount,
                  status: 'PENDING',
                },
                update: {},
              });

              reason = 'confirmed';
            }
          }
          break;
        }

        case 'failed': {
          // Check reservation atomically — if CONFIRMED, ignore (out-of-order)
          const reservation = await tx.reservation.findUnique({
            where: { id: reservationId },
            select: { status: true },
          });
          if (reservation?.status === 'CONFIRMED') {
            webhookResult = 'IGNORED';
            reason = 'reservation_already_confirmed_out_of_order';
          } else if (payment.status === 'FAILED') {
            webhookResult = 'IGNORED';
            reason = 'already_failed';
          } else {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: 'FAILED', failedAt: new Date() },
            });
            reason = 'marked_failed';
          }
          break;
        }

        case 'cancelled': {
          // Only allow cancel if PortOne confirms cancellation
          try {
            const portoneDetail = await this.portoneService.getPaymentDetail(providerPaymentId);
            const portoneStatus = portoneDetail?.status;
            if (portoneStatus !== 'CANCELLED' && portoneStatus !== 'cancelled') {
              webhookResult = 'IGNORED';
              reason = `cancel_not_verified: portone_status=${portoneStatus}`;
              break;
            }
          } catch {
            webhookResult = 'IGNORED';
            reason = 'cancel_verification_failed';
            break;
          }

          // Atomic: only transitions if currently CONFIRMED
          const cancelRes = await tx.reservation.updateMany({
            where: { id: reservationId, status: 'CONFIRMED' },
            data: { status: 'CANCELLED' },
          });
          if (cancelRes.count === 0) {
            webhookResult = 'IGNORED';
            reason = 'reservation_not_confirmed_or_already_cancelled';
          } else {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: 'CANCELLED', cancelledAt: new Date() },
            });
            reason = 'cancelled_verified';
          }
          break;
        }

        default: {
          webhookResult = 'IGNORED';
          reason = `unknown_event_type: ${eventType}`;
        }
      }

      await tx.paymentWebhookEvent.update({
        where: { provider_eventKey: { provider: 'PORTONE', eventKey } },
        data: { status: webhookResult, processedAt: new Date() },
      });

      return { result: webhookResult, reason };
    });

    this.logger.log(
      JSON.stringify({
        msg: 'webhook_processed',
        eventKey,
        merchantUid,
        eventType,
        result: result.result,
        reason: result.reason,
      }),
    );

    return { status: 'ok' };
  }

  async processRefund(reservationId: string, refundAmount: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { reservationId },
    });

    if (!payment) {
      throw new NotFoundException('결제 정보를 찾을 수 없습니다');
    }

    if (refundAmount > 0) {
      await this.portoneService.requestRefund(
        payment.portonePaymentId,
        refundAmount,
        '예약 취소',
      );
    }

    const newRefundedAmount = payment.refundedAmount + refundAmount;
    const status = newRefundedAmount >= payment.amount ? 'REFUNDED' : 'PARTIAL_REFUND';

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status,
        refundedAmount: newRefundedAmount,
        refundedAt: new Date(),
      },
    });
  }
}
