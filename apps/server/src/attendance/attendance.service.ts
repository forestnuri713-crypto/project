import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { VerifyQrDto } from './dto/verify-qr.dto';

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
}
