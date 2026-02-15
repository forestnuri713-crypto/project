import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const USER_SELECT = {
  id: true,
  name: true,
  slug: true,
  profileImageUrl: true,
  instructorStatus: true,
  certifications: true,
  providerMemberships: {
    where: { status: 'ACTIVE' as const },
    take: 1,
    include: {
      provider: {
        select: { id: true, name: true },
      },
    },
  },
};

export interface InstructorProfileResult {
  redirect?: string;
  profile?: {
    success: true;
    data: {
      id: string;
      slug: string;
      isPublic: boolean;
      displayName: string;
      profileImageUrl: string | null;
      coverImageUrl: string | null;
      bio: string | null;
      certifications: { title: string; issuer: string | null; issuedAt: string | null }[];
      provider: { id: string; name: string } | null;
    };
  };
}

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getInstructorProfile(key: string): Promise<InstructorProfileResult> {
    const isUuid = UUID_REGEX.test(key);

    const user = isUuid
      ? await this.prisma.user.findUnique({
          where: { id: key },
          select: USER_SELECT,
        })
      : await this.prisma.user.findFirst({
          where: { slug: key.toLowerCase() },
          select: USER_SELECT,
        });

    if (!user && !isUuid) {
      // Slug not found — check slug history for redirects
      const history = await this.prisma.slugHistory.findUnique({
        where: { slug: key.toLowerCase() },
        select: { user: { select: { slug: true, instructorStatus: true } } },
      });
      if (history && history.user.instructorStatus === 'APPROVED' && history.user.slug) {
        return { redirect: history.user.slug };
      }
    }

    if (!user || user.instructorStatus !== 'APPROVED') {
      throw new NotFoundException('Not Found');
    }

    // 308 redirect: UUID access when canonical slug exists
    if (isUuid && user.slug) {
      return { redirect: user.slug };
    }

    const certifications = Array.isArray(user.certifications)
      ? (user.certifications as { title: string; issuer?: string; issuedAt?: string }[])
      : [];

    const membership = user.providerMemberships[0] ?? null;

    return {
      profile: {
        success: true,
        data: {
          id: user.id,
          slug: user.slug ?? user.id,
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
      },
    };
  }
}
