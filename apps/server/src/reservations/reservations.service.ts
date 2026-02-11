import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { REFUND_POLICY, REDIS_LOCK_TTL_MS } from '@sooptalk/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PaymentsService } from '../payments/payments.service';
import { isTerminalReservationStatus } from '../domain/reservation.util';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { QueryReservationDto } from './dto/query-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private paymentsService: PaymentsService,
  ) {}

  async create(userId: string, dto: CreateReservationDto) {
    const lockKey = `program:${dto.programId}:lock`;
    const lockValue = await this.redisService.acquireLock(lockKey, REDIS_LOCK_TTL_MS);

    if (!lockValue) {
      throw new ConflictException('다른 사용자가 예약 중입니다. 잠시 후 다시 시도해주세요');
    }

    try {
      const program = await this.prisma.program.findUnique({
        where: { id: dto.programId },
        include: {
          _count: {
            select: {
              reservations: {
                where: { status: { in: ['PENDING', 'CONFIRMED'] } },
              },
            },
          },
        },
      });

      if (!program) {
        throw new NotFoundException('프로그램을 찾을 수 없습니다');
      }

      const remainingCapacity = program.maxCapacity - program._count.reservations;
      if (dto.participantCount > remainingCapacity) {
        throw new BadRequestException(
          `잔여석이 부족합니다. 현재 잔여석: ${remainingCapacity}`,
        );
      }

      const totalPrice = program.price * dto.participantCount;

      return await this.prisma.reservation.create({
        data: {
          userId,
          programId: dto.programId,
          participantCount: dto.participantCount,
          totalPrice,
          status: 'PENDING',
        },
        include: {
          program: { select: { id: true, title: true, scheduleAt: true, location: true } },
        },
      });
    } finally {
      await this.redisService.releaseLock(lockKey, lockValue);
    }
  }

  async findAll(userId: string, query: QueryReservationDto) {
    const where: Prisma.ReservationWhereInput = { userId };

    if (query.status) {
      where.status = query.status;
    }

    return this.prisma.reservation.findMany({
      where,
      include: {
        program: {
          select: { id: true, title: true, scheduleAt: true, location: true, price: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        program: {
          include: {
            instructor: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException('예약을 찾을 수 없습니다');
    }

    if (reservation.userId !== userId) {
      throw new ForbiddenException('본인의 예약만 조회할 수 있습니다');
    }

    return reservation;
  }

  async cancel(id: string, userId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { program: true, payment: true },
    });

    if (!reservation) {
      throw new NotFoundException('예약을 찾을 수 없습니다');
    }

    if (reservation.userId !== userId) {
      throw new ForbiddenException('본인의 예약만 취소할 수 있습니다');
    }

    if (isTerminalReservationStatus(reservation.status)) {
      throw new BadRequestException(
        reservation.status === 'CANCELLED'
          ? '이미 취소된 예약입니다'
          : '완료된 예약은 취소할 수 없습니다',
      );
    }

    const now = new Date();
    const scheduleAt = reservation.program.scheduleAt;
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

    const refundAmount = Math.floor(reservation.totalPrice * refundRatio);

    // PortOne 실제 환불 처리
    if (reservation.payment && refundAmount > 0) {
      await this.paymentsService.processRefund(reservation.id, refundAmount);
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        program: { select: { id: true, title: true, scheduleAt: true } },
      },
    });

    return {
      ...updated,
      refundRatio,
      refundAmount,
    };
  }
}
