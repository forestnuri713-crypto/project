import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getInstructorProfile(slug: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: slug },
      select: {
        id: true,
        name: true,
        profileImageUrl: true,
        instructorStatus: true,
        certifications: true,
        providerMemberships: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: {
            provider: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!user || user.instructorStatus !== 'APPROVED') {
      throw new NotFoundException('Not Found');
    }

    const certifications = Array.isArray(user.certifications)
      ? (user.certifications as { title: string; issuer?: string; issuedAt?: string }[])
      : [];

    const membership = user.providerMemberships[0] ?? null;

    return {
      success: true,
      data: {
        id: user.id,
        slug: user.id,
        isPublic: true,
        displayName: user.name,
        profileImageUrl: user.profileImageUrl ?? null,
        coverImageUrl: null,
        bio: null,
        certifications: certifications.map((c) => ({
          title: c.title ?? '',
          issuer: c.issuer ?? null,
          issuedAt: c.issuedAt ?? null,
        })),
        provider: membership
          ? { id: membership.provider.id, name: membership.provider.name }
          : null,
      },
    };
  }
}
