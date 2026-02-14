import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { CategoriesService } from '../categories/categories.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { QueryProgramDto } from './dto/query-program.dto';
import { DiscoverProgramDto } from './dto/discover-program.dto';

@Injectable()
export class ProgramsService {
  constructor(
    private prisma: PrismaService,
    private categoriesService: CategoriesService,
  ) {}

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

  /** Returns active schedules for a program, ordered by startAt asc. */
  async findSchedules(programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });

    if (!program) {
      throw new NotFoundException('프로그램을 찾을 수 없습니다');
    }

    // Return only ACTIVE schedules; cancelled schedules are excluded.
    return this.prisma.programSchedule.findMany({
      where: { programId, status: 'ACTIVE' },
      select: { id: true, startAt: true, endAt: true, capacity: true, status: true },
      orderBy: { startAt: 'asc' },
    });
  }

  async discover(query: DiscoverProgramDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sort = query.sort ?? 'latest';

    const where: Prisma.ProgramWhereInput = {
      approvalStatus: 'APPROVED',
    };

    // keyword filter — SPEC §4.1: trim 후 2글자 미만이면 400
    if (query.keyword !== undefined) {
      const trimmed = query.keyword.trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        throw new BusinessException(
          'VALIDATION_ERROR',
          '검색 키워드는 2~100자 사이여야 합니다',
          400,
        );
      }
      where.title = { contains: trimmed, mode: 'insensitive' };
    }

    // category filter
    if (query.category) {
      await this.categoriesService.findBySlug(query.category);
      where.categories = {
        some: { category: { slug: query.category } },
      };
    }

    // Region filter — provider.regionTags is Json and not filterable via Prisma
    // operators in this codebase (Prisma 5.x). Using program.location contains as
    // a safe fallback. Raw SQL matching on regionTags deferred to a future sprint.
    if (query.region) {
      where.location = { contains: query.region, mode: 'insensitive' };
    }

    // sort
    let orderBy: Prisma.ProgramOrderByWithRelationInput;
    switch (sort) {
      case 'rating':
        orderBy = { ratingAvg: 'desc' };
        break;
      case 'priceAsc':
        orderBy = { price: 'asc' };
        break;
      case 'priceDesc':
        orderBy = { price: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.program.findMany({
        where,
        include: {
          instructor: { select: { id: true, name: true, profileImageUrl: true } },
          gallery: { take: 1, orderBy: { createdAt: 'asc' } },
          provider: { select: { regionTags: true } },
          categories: { include: { category: { select: { slug: true, name: true } } } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.program.count({ where }),
    ]);

    const mapped = items.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      location: p.location,
      price: p.price,
      minPrice: p.price,
      ratingAvg: p.ratingAvg,
      reviewCount: p.reviewCount,
      coverImageUrl: p.gallery[0]?.imageKey ?? null,
      regionTags: (p.provider?.regionTags as string[]) ?? [],
      categories: p.categories.map((pc) => ({ slug: pc.category.slug, name: pc.category.name })),
      scheduleAt: p.scheduleAt,
      instructor: p.instructor,
      createdAt: p.createdAt,
    }));

    return { items: mapped, total, page, pageSize };
  }
}
