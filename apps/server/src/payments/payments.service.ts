import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PortoneService } from './portone.service';
import { PreparePaymentDto } from './dto/prepare-payment.dto';

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

    await this.prisma.payment.create({
      data: {
        reservationId: reservation.id,
        method: dto.method,
        portonePaymentId,
        amount: reservation.totalPrice,
        status: 'PENDING',
      },
    });

    await this.portoneService.preRegister(portonePaymentId, reservation.totalPrice);

    return {
      paymentId: portonePaymentId,
      storeId: this.configService.get<string>('PORTONE_STORE_ID'),
      channelKey: this.configService.get<string>('PORTONE_CHANNEL_KEY'),
      amount: reservation.totalPrice,
      orderName: reservation.program.title,
    };
  }

  async handleWebhook(paymentId: string) {
    const portoneDetail = await this.portoneService.getPaymentDetail(paymentId);

    const payment = await this.prisma.payment.findUnique({
      where: { portonePaymentId: paymentId },
      include: { reservation: true },
    });

    if (!payment) {
      this.logger.warn(`Webhook: payment not found for ${paymentId}`);
      return;
    }

    if (payment.status !== 'PENDING') {
      this.logger.warn(`Webhook: payment ${paymentId} already processed (${payment.status})`);
      return;
    }

    const paidAmount = portoneDetail?.amount?.total;
    if (paidAmount !== payment.amount) {
      this.logger.error(
        `Webhook: amount mismatch for ${paymentId}. Expected ${payment.amount}, got ${paidAmount}`,
      );
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paidAt: new Date() },
      }),
      this.prisma.reservation.update({
        where: { id: payment.reservationId },
        data: { status: 'CONFIRMED' },
      }),
      this.prisma.attendance.create({
        data: {
          reservationId: payment.reservationId,
          qrCode: randomUUID(),
          status: 'NO_SHOW',
        },
      }),
    ]);

    this.logger.log(`Payment confirmed: ${paymentId}`);
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
