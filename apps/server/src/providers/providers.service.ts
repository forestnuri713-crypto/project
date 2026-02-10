import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  PROVIDER_COVER_UPLOAD_URL_EXPIRES_IN,
  GALLERY_SIGNED_URL_EXPIRES_IN,
  PROVIDER_GALLERY_PREVIEW_MAX_COUNT,
  ProviderRole,
} from '@sooptalk/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { PresignCoverDto } from './dto/presign-cover.dto';
import { PublishProfileDto } from './dto/publish-profile.dto';

@Injectable()
export class ProvidersService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  /**
   * 권한 검증: userId가 해당 Provider의 allowedRoles에 속하는 ACTIVE 멤버인지 확인
   * 성공 시 ProviderMember(+ provider) 반환, 실패 시 ForbiddenException
   */
  async verifyProviderRole(
    userId: string,
    allowedRoles: ProviderRole[],
  ) {
    const member = await this.prisma.providerMember.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        roleInProvider: { in: allowedRoles },
      },
      include: { provider: true },
    });

    if (!member) {
      throw new ForbiddenException(
        '해당 업체의 권한이 없습니다',
      );
    }

    return member;
  }

  /** 공개 프로필 조회 (미공개 시 404) — 프로그램/갤러리 자동 구성 포함 */
  async getPublicProfile(providerId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { providerId },
      include: {
        provider: {
          include: {
            members: {
              where: { status: 'ACTIVE' },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    profileImageUrl: true,
                    certifications: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!profile || !profile.isPublished) {
      throw new NotFoundException('프로필을 찾을 수 없습니다');
    }

    // 멤버 userId 목록 수집
    const memberUserIds = profile.provider.members.map((m) => m.user.id);

    // 프로그램 조회: 승인된 프로그램 중 (소속 강사 OR provider 직접 연결)
    const programs = await this.prisma.program.findMany({
      where: {
        approvalStatus: 'APPROVED',
        OR: [
          { instructorId: { in: memberUserIds } },
          { providerId },
        ],
      },
      include: {
        instructor: {
          select: { id: true, name: true, profileImageUrl: true },
        },
      },
      orderBy: { scheduleAt: 'asc' },
    });

    // 갤러리 조회: 위 프로그램 기반 최근 N개
    const programIds = programs.map((p) => p.id);
    const galleryItems = programIds.length > 0
      ? await this.prisma.gallery.findMany({
          where: { programId: { in: programIds } },
          orderBy: { createdAt: 'desc' },
          take: PROVIDER_GALLERY_PREVIEW_MAX_COUNT,
        })
      : [];

    // coverImageUrls에 대해 presigned download URL 생성
    const coverImageKeys = profile.coverImageUrls as string[];
    const coverImageUrls = await Promise.all(
      coverImageKeys.map((key) =>
        this.storageService.generateDownloadUrl(
          key,
          GALLERY_SIGNED_URL_EXPIRES_IN,
        ),
      ),
    );

    // 갤러리 thumbnailKey → presigned URL 생성
    const gallery = await Promise.all(
      galleryItems.map(async (item) => ({
        id: item.id,
        programId: item.programId,
        thumbnailUrl: await this.storageService.generateDownloadUrl(
          item.thumbnailKey,
          GALLERY_SIGNED_URL_EXPIRES_IN,
        ),
        createdAt: item.createdAt,
      })),
    );

    const { provider, ...profileData } = profile;

    return {
      ...profileData,
      coverImageUrls,
      members: provider.members.map((m) => ({
        id: m.id,
        roleInProvider: m.roleInProvider,
        user: m.user,
      })),
      programs,
      gallery,
    };
  }

  /** 프로필 upsert */
  async upsertProfile(userId: string, dto: UpsertProfileDto) {
    const member = await this.verifyProviderRole(userId, [
      ProviderRole.OWNER,
      ProviderRole.MANAGER,
    ]);

    const data = {
      displayName: dto.displayName,
      introShort: dto.introShort ?? null,
      certificationsText: dto.certificationsText ?? null,
      storyText: dto.storyText ?? null,
      coverImageUrls: dto.coverImageUrls ?? [],
      contactLinks: dto.contactLinks ?? [],
    };

    return this.prisma.providerProfile.upsert({
      where: { providerId: member.providerId },
      create: {
        providerId: member.providerId,
        ...data,
      },
      update: data,
    });
  }

  /** 커버 이미지 presigned upload URL 생성 */
  async presignCoverImages(userId: string, dto: PresignCoverDto) {
    const member = await this.verifyProviderRole(userId, [
      ProviderRole.OWNER,
      ProviderRole.MANAGER,
    ]);

    const uploads = await Promise.all(
      dto.files.map(async (file) => {
        const ext = path.extname(file.filename);
        const key = `provider-covers/${member.providerId}/${randomUUID()}${ext}`;
        const uploadUrl = await this.storageService.generateUploadUrl(
          key,
          file.contentType,
          PROVIDER_COVER_UPLOAD_URL_EXPIRES_IN,
        );
        return { key, uploadUrl };
      }),
    );

    return { uploads };
  }

  /** 공개/비공개 전환 */
  async togglePublish(userId: string, dto: PublishProfileDto) {
    const member = await this.verifyProviderRole(userId, [
      ProviderRole.OWNER,
      ProviderRole.MANAGER,
    ]);

    const profile = await this.prisma.providerProfile.findUnique({
      where: { providerId: member.providerId },
    });

    if (!profile) {
      throw new NotFoundException('프로필을 먼저 생성해주세요');
    }

    return this.prisma.providerProfile.update({
      where: { providerId: member.providerId },
      data: { isPublished: dto.isPublished },
    });
  }

  /** 소속 멤버 목록 조회 */
  async getMembers(userId: string, providerId: string) {
    // 요청자 권한 검증
    const member = await this.prisma.providerMember.findFirst({
      where: {
        userId,
        providerId,
        status: 'ACTIVE',
        roleInProvider: { in: ['OWNER', 'MANAGER'] },
      },
    });

    if (!member) {
      throw new ForbiddenException('해당 업체의 멤버 목록을 조회할 권한이 없습니다');
    }

    return this.prisma.providerMember.findMany({
      where: { providerId },
      include: {
        user: {
          select: { id: true, name: true, email: true, profileImageUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
