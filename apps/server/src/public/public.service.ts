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

function encodeCursor(updatedAt: Date, id: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string): { updatedAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString();
    const sep = raw.indexOf('|');
    if (sep === -1) return null;
    const updatedAt = new Date(raw.slice(0, sep));
    const id = raw.slice(sep + 1);
    if (isNaN(updatedAt.getTime()) || !id) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
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

  async listApprovedInstructors(cursor?: string, limit = 20) {
    const baseWhere: Record<string, unknown> = {
      instructorStatus: 'APPROVED' as const,
      slug: { not: null },
    };

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        baseWhere.OR = [
          { updatedAt: { lt: decoded.updatedAt } },
          { updatedAt: { equals: decoded.updatedAt }, id: { lt: decoded.id } },
        ];
      } else if (process.env.NODE_ENV !== 'production') {
        console.warn('[public] invalid cursor ignored:', cursor);
      }
    }

    const rows = await this.prisma.user.findMany({
      where: baseWhere,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, slug: true, updatedAt: true },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? encodeCursor(lastItem.updatedAt, lastItem.id)
        : null;

    return {
      items: items.map((r) => ({ slug: r.slug!, updatedAt: r.updatedAt })),
      nextCursor,
      hasMore,
    };
  }
}
