import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstructorService {
  constructor(private prisma: PrismaService) {}

  private normalizeSlug(raw: string): string {
    return raw
      .toLowerCase()
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async updateSlug(userId: string, newSlug: string) {
    const slug = this.normalizeSlug(newSlug);

    // 1. Read current user for early guards
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, slug: true, slugChangeCount: true, instructorStatus: true },
    });

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    if (user.instructorStatus !== 'APPROVED') {
      throw new ForbiddenException('INSTRUCTOR_NOT_APPROVED');
    }

    if (user.slugChangeCount >= 1) {
      throw new BadRequestException('SLUG_CHANGE_EXHAUSTED');
    }

    if (slug === user.slug) {
      throw new BadRequestException('SLUG_UNCHANGED');
    }

    // 2. Atomic conditional update — prevents race conditions
    try {
      const result = await this.prisma.user.updateMany({
        where: {
          id: userId,
          slugChangeCount: { lt: 1 },
          instructorStatus: 'APPROVED',
        },
        data: { slug, slugChangeCount: { increment: 1 } },
      });

      if (result.count === 0) {
        throw new BadRequestException('SLUG_CHANGE_EXHAUSTED');
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('SLUG_TAKEN');
      }
      throw error;
    }

    return { success: true, data: { slug } };
  }
}
