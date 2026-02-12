import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: {
            programs: {
              where: { program: { approvalStatus: 'APPROVED' } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      programCount: c._count.programs,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!category) {
      throw new BusinessException('CATEGORY_NOT_FOUND', '카테고리를 찾을 수 없습니다', 404);
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BusinessException('CATEGORY_SLUG_CONFLICT', '이미 사용 중인 슬러그입니다', 409);
    }

    return this.prisma.category.create({
      data: { name: dto.name, slug: dto.slug },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new BusinessException('CATEGORY_NOT_FOUND', '카테고리를 찾을 수 없습니다', 404);
    }

    if (dto.slug && dto.slug !== category.slug) {
      const conflict = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });
      if (conflict) {
        throw new BusinessException('CATEGORY_SLUG_CONFLICT', '이미 사용 중인 슬러그입니다', 409);
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
      },
    });
  }

  async delete(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new BusinessException('CATEGORY_NOT_FOUND', '카테고리를 찾을 수 없습니다', 404);
    }

    await this.prisma.category.delete({ where: { id } });

    return { deleted: true };
  }
}
