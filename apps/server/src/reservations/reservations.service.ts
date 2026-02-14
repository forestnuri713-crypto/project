import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { REFUND_POLICY, REDIS_LOCK_TTL_MS } from '@sooptalk/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PaymentsService } from '../payments/payments.service';
import { BusinessException } from '../common/exceptions/business.exception';
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
    if (dto.participantCount <= 0) {
      throw new BusinessException(
        'VALIDATION_ERROR',
        '참여 인원은 1명 이상이어야 합니다',
        400,
      );
    }

    const lockKey = `program:${dto.programId}:lock`;
    const lockValue = await this.redisService.acquireLock(lockKey, REDIS_LOCK_TTL_MS);

    if (!lockValue) {
      throw new BusinessException(
       'RESERVATION_CONFLICT',
       '다른 사용자가 예약 중입니다. 잠시 후 다시 시도해주세요',
       409,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const program = await tx.program.findUnique({
          where: { id: dto.programId },
          select: { id: true, maxCapacity: true, reservedCount: true, price: true },
        });

       if (!program) {
         throw new BusinessException(
          'PROGRAM_NOT_FOUND',
          '프로그램을 찾을 수 없습니다',
          404,
         );
        }

        // --- Resolve ProgramSchedule ---
        let scheduleId: string;
        if (dto.programScheduleId) {
          // Preferred path: use provided scheduleId
          const schedule = await tx.programSchedule.findUnique({
            where: { id: dto.programScheduleId },
          });
          if (!schedule || schedule.programId !== dto.programId) {
            throw new BusinessException(
              'SCHEDULE_NOT_FOUND',
              '프로그램 회차를 찾을 수 없습니다',
              404,
            );
          }
          if (schedule.status === 'CANCELLED') {
            throw new BusinessException(
              'SCHEDULE_CANCELLED',
              '취소된 회차에는 예약할 수 없습니다',
              400,
            );
          }
          scheduleId = schedule.id;
        } else if (dto.startAt) {
          // Fallback: upsert schedule by (programId, startAt)
          const schedule = await tx.programSchedule.upsert({
            where: {
              programId_startAt: {
                programId: dto.programId,
                startAt: new Date(dto.startAt),
              },
            },
            create: {
              programId: dto.programId,
              startAt: new Date(dto.startAt),
              capacity: program.maxCapacity,
              remainingCapacity: program.maxCapacity,
              status: 'ACTIVE',
            },
            update: {},
          });
          scheduleId = schedule.id;
        } else {
          throw new BusinessException(
            'VALIDATION_ERROR',
            'programScheduleId 또는 startAt이 필요합니다',
            400,
          );
        }

        // --- Atomic schedule-level capacity decrement ---
        const decremented = await tx.$executeRaw`
          UPDATE "program_schedules"
          SET "remaining_capacity" = "remaining_capacity" - ${dto.participantCount},
              "updated_at" = NOW()
          WHERE "id" = ${scheduleId}
            AND "status" = 'ACTIVE'
            AND "remaining_capacity" >= ${dto.participantCount}
        `;

        if (decremented === 0) {
          throw new BusinessException(
            'CAPACITY_EXCEEDED',
            '잔여석이 부족합니다',
            400,
          );
        }

        // Program-level reserved_count (analytics only, no enforcement)
        await tx.$executeRaw`
          UPDATE "programs"
          SET "reserved_count" = "reserved_count" + ${dto.participantCount}
          WHERE "id" = ${dto.programId}
        `;

        const totalPrice = program.price * dto.participantCount;

        return tx.reservation.create({
          data: {
            userId,
            programId: dto.programId,
            programScheduleId: scheduleId,
            participantCount: dto.participantCount,
            totalPrice,
            status: 'PENDING',
          },
          include: {
            program: { select: { id: true, title: true, scheduleAt: true, location: true } },
          },
        });
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
    throw new BusinessException(
     'RESERVATION_NOT_FOUND',
     '예약을 찾을 수 없습니다',
     404,
   );
  } 

  if (reservation.userId !== userId) {
    throw new BusinessException(
     'RESERVATION_FORBIDDEN',
     '본인의 예약만 조회할 수 있습니다',
     403,
   );
  }

  return reservation;
}

  async cancel(id: string, userId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { program: true, payment: true },
    });

    if (!reservation) {
      throw new BusinessException(
       'RESERVATION_NOT_FOUND',
       '예약을 찾을 수 없습니다',
       404,
     );
    }

    if (reservation.userId !== userId) {
      throw new BusinessException(
       'RESERVATION_FORBIDDEN',
       '본인의 예약만 취소할 수 있습니다',
       403,
     );
    }

    if (reservation.status === 'CANCELLED') {
      throw new BusinessException(
        'RESERVATION_ALREADY_CANCELLED',
        '이미 취소된 예약입니다',
        400,
      );
    }

    if (reservation.status === 'COMPLETED') {
      throw new BusinessException(
        'RESERVATION_COMPLETED',
        '완료된 예약은 취소할 수 없습니다',
        400,
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.reservation.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          program: { select: { id: true, title: true, scheduleAt: true } },
        },
      });

      // Atomic decrement: restore capacity
      const decremented = await tx.$executeRaw`
        UPDATE "programs"
        SET "reserved_count" = "reserved_count" - ${reservation.participantCount}
        WHERE "id" = ${reservation.programId}
          AND "reserved_count" - ${reservation.participantCount} >= 0
      `;

      if (decremented === 0) {
        throw new BusinessException(
          'INVARIANT_VIOLATION',
          'reservedCount 감소 중 불변 조건 위반',
          500,
        );
      }

      return result;
    });

    return {
      ...updated,
      refundRatio,
      refundAmount,
    };
  }
}
