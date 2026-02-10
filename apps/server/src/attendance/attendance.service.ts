import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AUTO_CHECKIN_RADIUS_METERS,
  AUTO_CHECKIN_TIME_WINDOW_MINUTES,
} from '@sooptalk/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { VerifyQrDto } from './dto/verify-qr.dto';
import { AutoCheckinDto } from './dto/auto-checkin.dto';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async markAttendance(instructorId: string, dto: MarkAttendanceDto) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { reservationId: dto.reservationId },
      include: {
        reservation: {
          include: { program: true },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException('출석 정보를 찾을 수 없습니다');
    }

    if (attendance.reservation.program.instructorId !== instructorId) {
      throw new ForbiddenException('해당 프로그램의 강사만 출석 체크할 수 있습니다');
    }

    const updates: any[] = [
      this.prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          status: dto.status,
          checkedAt: new Date(),
          checkedBy: instructorId,
        },
      }),
    ];

    if (dto.status === 'ATTENDED') {
      updates.push(
        this.prisma.reservation.update({
          where: { id: attendance.reservationId },
          data: { status: 'COMPLETED' },
        }),
      );
    }

    const [updatedAttendance] = await this.prisma.$transaction(updates);
    return updatedAttendance;
  }

  async getQrCode(userId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException('예약을 찾을 수 없습니다');
    }

    if (reservation.userId !== userId) {
      throw new ForbiddenException('본인의 예약만 조회할 수 있습니다');
    }

    const attendance = await this.prisma.attendance.findUnique({
      where: { reservationId },
    });

    if (!attendance) {
      throw new NotFoundException('출석 정보를 찾을 수 없습니다. 결제 완료 후 QR이 생성됩니다');
    }

    return { qrCode: attendance.qrCode };
  }

  async verifyQrCode(instructorId: string, dto: VerifyQrDto) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { qrCode: dto.qrCode },
      include: {
        reservation: {
          include: { program: true },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException('유효하지 않은 QR 코드입니다');
    }

    if (attendance.reservation.program.instructorId !== instructorId) {
      throw new ForbiddenException('해당 프로그램의 강사만 출석 확인할 수 있습니다');
    }

    const [updatedAttendance] = await this.prisma.$transaction([
      this.prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          status: 'ATTENDED',
          checkedAt: new Date(),
          checkedBy: instructorId,
        },
      }),
      this.prisma.reservation.update({
        where: { id: attendance.reservationId },
        data: { status: 'COMPLETED' },
      }),
    ]);

    return updatedAttendance;
  }

  async autoCheckin(userId: string, dto: AutoCheckinDto) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { reservationId: dto.reservationId },
      include: {
        reservation: {
          include: { program: true },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException('출석 정보를 찾을 수 없습니다');
    }

    if (attendance.reservation.userId !== userId) {
      throw new ForbiddenException('본인의 예약만 자동 출석할 수 있습니다');
    }

    if (attendance.status === 'ATTENDED') {
      throw new BadRequestException('이미 출석 처리되었습니다');
    }

    // Time window check: ±30 minutes from program start
    const now = new Date();
    const scheduleAt = attendance.reservation.program.scheduleAt;
    const diffMinutes = Math.abs(now.getTime() - scheduleAt.getTime()) / (1000 * 60);

    if (diffMinutes > AUTO_CHECKIN_TIME_WINDOW_MINUTES) {
      throw new BadRequestException(
        `자동 출석은 프로그램 시작 시간 전후 ${AUTO_CHECKIN_TIME_WINDOW_MINUTES}분 이내에만 가능합니다`,
      );
    }

    // Haversine distance check: ≤100m from program location
    const distance = this.haversineDistance(
      dto.latitude,
      dto.longitude,
      attendance.reservation.program.latitude,
      attendance.reservation.program.longitude,
    );

    if (distance > AUTO_CHECKIN_RADIUS_METERS) {
      throw new BadRequestException(
        `프로그램 장소에서 ${AUTO_CHECKIN_RADIUS_METERS}m 이내에서만 자동 출석할 수 있습니다`,
      );
    }

    const [updatedAttendance] = await this.prisma.$transaction([
      this.prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          status: 'ATTENDED',
          checkedAt: now,
          checkinLatitude: dto.latitude,
          checkinLongitude: dto.longitude,
        },
      }),
      this.prisma.reservation.update({
        where: { id: attendance.reservationId },
        data: { status: 'COMPLETED' },
      }),
    ]);

    return updatedAttendance;
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
