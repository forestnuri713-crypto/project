import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminQueryProgramsDto } from './dto/admin-query-programs.dto';
import { RejectProgramDto } from './dto/reject-program.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { AdminQueryUsersDto } from './dto/admin-query-users.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async getDashboardStats() {
    const [totalUsers, totalReservations, totalRevenue, pendingPrograms] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.reservation.count({
          where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
        }),
        this.prisma.payment.aggregate({
          where: { status: 'PAID' },
          _sum: { amount: true },
        }),
        this.prisma.program.count({
          where: { approvalStatus: 'PENDING_REVIEW' },
        }),
      ]);

    return {
      totalUsers,
      totalReservations,
      totalRevenue: totalRevenue._sum.amount ?? 0,
      pendingPrograms,
    };
  }

  async findPrograms(query: AdminQueryProgramsDto) {
    const where: Prisma.ProgramWhereInput = {};

    if (query.approvalStatus) {
      where.approvalStatus = query.approvalStatus;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { instructor: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        include: {
          instructor: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.program.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async approveProgram(id: string) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      select: { id: true, title: true, instructorId: true, approvalStatus: true },
    });

    if (!program) {
      throw new NotFoundException('프로그램을 찾을 수 없습니다');
    }

    if (program.approvalStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException('검수 대기 상태의 프로그램만 승인할 수 있습니다');
    }

    const updated = await this.prisma.program.update({
      where: { id },
      data: { approvalStatus: 'APPROVED', rejectionReason: null },
    });

    await this.notificationsService.createAndSend(
      program.instructorId,
      'PROGRAM_APPROVED',
      '프로그램 승인 알림',
      `"${program.title}" 프로그램이 승인되었습니다. 이제 부모님들에게 노출됩니다.`,
      { programId: program.id },
    );

    return updated;
  }

  async rejectProgram(id: string, dto: RejectProgramDto) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      select: { id: true, title: true, instructorId: true, approvalStatus: true },
    });

    if (!program) {
      throw new NotFoundException('프로그램을 찾을 수 없습니다');
    }

    if (program.approvalStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException('검수 대기 상태의 프로그램만 거절할 수 있습니다');
    }

    const updated = await this.prisma.program.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        rejectionReason: dto.rejectionReason,
      },
    });

    await this.notificationsService.createAndSend(
      program.instructorId,
      'PROGRAM_REJECTED',
      '프로그램 거절 알림',
      `"${program.title}" 프로그램이 거절되었습니다. 사유: ${dto.rejectionReason}`,
      { programId: program.id },
    );

    return updated;
  }

  async findUsers(query: AdminQueryUsersDto) {
    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phoneNumber: true,
          profileImageUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async changeUserRole(id: string, dto: ChangeRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }
}
