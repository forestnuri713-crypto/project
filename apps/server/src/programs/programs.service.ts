import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { QueryProgramDto } from './dto/query-program.dto';

@Injectable()
export class ProgramsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryProgramDto) {
    const where: Prisma.ProgramWhereInput = {
      approvalStatus: 'APPROVED',
    };

    if (query.location) {
      where.location = { contains: query.location, mode: 'insensitive' };
    }

    if (query.dateFrom || query.dateTo) {
      where.scheduleAt = {};
      if (query.dateFrom) {
        where.scheduleAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.scheduleAt.lte = new Date(query.dateTo);
      }
    }

    if (query.minAge !== undefined) {
      where.minAge = { lte: query.minAge };
    }

    return this.prisma.program.findMany({
      where,
      include: { instructor: { select: { id: true, name: true, profileImageUrl: true } } },
      orderBy: { scheduleAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      include: {
        instructor: { select: { id: true, name: true, profileImageUrl: true } },
        _count: {
          select: {
            gallery: true,
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

    return program;
  }

  async create(instructorId: string, dto: CreateProgramDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: instructorId },
      select: { instructorStatus: true },
    });

    if (!user || user.instructorStatus !== 'APPROVED') {
      throw new ForbiddenException('승인된 강사만 프로그램을 등록할 수 있습니다');
    }

    return this.prisma.program.create({
      data: {
        ...dto,
        scheduleAt: new Date(dto.scheduleAt),
        instructorId,
      },
    });
  }

  async update(id: string, instructorId: string, dto: UpdateProgramDto) {
    const program = await this.prisma.program.findUnique({ where: { id } });

    if (!program) {
      throw new NotFoundException('프로그램을 찾을 수 없습니다');
    }

    if (program.instructorId !== instructorId) {
      throw new ForbiddenException('본인의 프로그램만 수정할 수 있습니다');
    }

    const data: Prisma.ProgramUpdateInput = { ...dto };
    if (dto.scheduleAt) {
      data.scheduleAt = new Date(dto.scheduleAt);
    }

    return this.prisma.program.update({ where: { id }, data });
  }

  async findMyPrograms(instructorId: string) {
    return this.prisma.program.findMany({
      where: { instructorId },
      include: {
        _count: {
          select: {
            reservations: {
              where: { status: { in: ['PENDING', 'CONFIRMED'] } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
