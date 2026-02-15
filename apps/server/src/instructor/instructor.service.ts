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

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Read current user inside transaction
        const user = await tx.user.findUnique({
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

        // 2. Archive old slug in history (if exists)
        if (user.slug) {
          await tx.slugHistory.create({
            data: { userId, slug: user.slug },
          });
        }

        // 3. Atomic conditional update — prevents race conditions
        const result = await tx.user.updateMany({
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
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('SLUG_TAKEN');
      }
      throw error;
    }

    return { success: true, data: { slug } };
  }
}
