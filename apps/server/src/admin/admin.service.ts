import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  PROVIDER_COVER_UPLOAD_URL_EXPIRES_IN,
  GALLERY_SIGNED_URL_EXPIRES_IN,
} from '@sooptalk/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { AdminQueryProgramsDto } from './dto/admin-query-programs.dto';
import { RejectProgramDto } from './dto/reject-program.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { AdminQueryUsersDto } from './dto/admin-query-users.dto';
import { ChargeCashDto } from './dto/charge-cash.dto';
import { AdminQueryInstructorsDto } from './dto/admin-query-instructors.dto';
import { RejectInstructorDto } from './dto/reject-instructor.dto';
import { UpdateCertificationsDto } from './dto/update-certifications.dto';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { AdminQueryProvidersDto } from './dto/admin-query-providers.dto';
import { AdminUpsertProfileDto } from './dto/admin-upsert-profile.dto';
import { PresignCoverDto } from '../providers/dto/presign-cover.dto';
import { PublishProfileDto } from '../providers/dto/publish-profile.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private storageService: StorageService,
  ) {}

  async getDashboardStats() {
    const [totalUsers, totalReservations, totalRevenue, pendingPrograms, pendingInstructors] =
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
        this.prisma.user.count({
          where: { instructorStatus: 'APPLIED' },
        }),
      ]);

    return {
      totalUsers,
      totalReservations,
      totalRevenue: totalRevenue._sum.amount ?? 0,
      pendingPrograms,
      pendingInstructors,
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

  async findInstructorApplications(query: AdminQueryInstructorsDto) {
    const where: Prisma.UserWhereInput = {
      role: 'INSTRUCTOR',
    };

    if (query.instructorStatus) {
      where.instructorStatus = query.instructorStatus;
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
          instructorStatus: true,
          instructorStatusReason: true,
          certifications: true,
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

  async approveInstructor(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, instructorStatus: true },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    if (user.instructorStatus !== 'APPLIED') {
      throw new BadRequestException('신청 대기 상태의 강사만 승인할 수 있습니다');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        instructorStatus: 'APPROVED',
        instructorStatusReason: null,
      },
    });

    await this.notificationsService.createAndSend(
      userId,
      'INSTRUCTOR_APPROVED',
      '강사 승인 알림',
      `${user.name}님의 강사 신청이 승인되었습니다. 이제 프로그램을 등록할 수 있습니다.`,
    );

    return updated;
  }

  async rejectInstructor(userId: string, dto: RejectInstructorDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, instructorStatus: true },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    if (user.instructorStatus !== 'APPLIED') {
      throw new BadRequestException('신청 대기 상태의 강사만 거절할 수 있습니다');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        instructorStatus: 'REJECTED',
        instructorStatusReason: dto.reason,
      },
    });

    await this.notificationsService.createAndSend(
      userId,
      'INSTRUCTOR_REJECTED',
      '강사 신청 거절 알림',
      `${user.name}님의 강사 신청이 거절되었습니다. 사유: ${dto.reason}`,
    );

    return updated;
  }

  async updateInstructorCertifications(userId: string, dto: UpdateCertificationsDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    if (user.role !== 'INSTRUCTOR') {
      throw new BadRequestException('강사만 인증 뱃지를 설정할 수 있습니다');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { certifications: dto.certifications as any },
      select: {
        id: true,
        name: true,
        certifications: true,
      },
    });
  }

  async chargeCash(userId: string, dto: ChargeCashDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        messageCashBalance: { increment: dto.amount },
      },
      select: {
        id: true,
        email: true,
        name: true,
        messageCashBalance: true,
      },
    });

    return updated;
  }

  // ─── Providers ─────────────────────────────────────

  async createProvider(dto: CreateProviderDto) {
    return this.prisma.provider.create({
      data: {
        name: dto.name,
        regionTags: dto.regionTags ?? [],
      },
    });
  }

  async findProviders(query: AdminQueryProvidersDto) {
    const where: Prisma.ProviderWhereInput = {};

    if (query.query) {
      where.name = { contains: query.query, mode: 'insensitive' };
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.provider.findMany({
        where,
        include: {
          profile: { select: { isPublished: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.provider.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async updateProvider(id: string, dto: UpdateProviderDto) {
    const provider = await this.prisma.provider.findUnique({ where: { id } });
    if (!provider) {
      throw new NotFoundException('업체를 찾을 수 없습니다');
    }

    const data: Prisma.ProviderUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.regionTags !== undefined) data.regionTags = dto.regionTags;

    return this.prisma.provider.update({ where: { id }, data });
  }

  async getProviderProfile(providerId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException('업체를 찾을 수 없습니다');
    }

    const profile = await this.prisma.providerProfile.findUnique({
      where: { providerId },
    });

    if (!profile) {
      return {
        provider: { id: provider.id, name: provider.name, regionTags: provider.regionTags },
        profile: {
          displayName: provider.name,
          introShort: null,
          certificationsText: null,
          storyText: null,
          coverImageUrls: [],
          contactLinks: [],
          isPublished: false,
        },
      };
    }

    const coverImageKeys = profile.coverImageUrls as string[];
    const coverImageUrls = await Promise.all(
      coverImageKeys.map((key) =>
        this.storageService.generateDownloadUrl(key, GALLERY_SIGNED_URL_EXPIRES_IN),
      ),
    );

    return {
      provider: { id: provider.id, name: provider.name, regionTags: provider.regionTags },
      profile: {
        displayName: profile.displayName,
        introShort: profile.introShort,
        certificationsText: profile.certificationsText,
        storyText: profile.storyText,
        coverImageUrls,
        contactLinks: profile.contactLinks,
        isPublished: profile.isPublished,
      },
    };
  }

  async upsertProviderProfile(providerId: string, dto: AdminUpsertProfileDto) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException('업체를 찾을 수 없습니다');
    }

    const data = {
      displayName: dto.displayName,
      introShort: dto.introShort ?? null,
      certificationsText: dto.certificationsText ?? null,
      storyText: dto.storyText ?? null,
      coverImageUrls: dto.coverImageUrls ?? [],
      contactLinks: dto.contactLinks ?? [],
    };

    return this.prisma.providerProfile.upsert({
      where: { providerId },
      create: { providerId, ...data },
      update: data,
    });
  }

  async presignProviderCoverImages(providerId: string, dto: PresignCoverDto) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException('업체를 찾을 수 없습니다');
    }

    const uploads = await Promise.all(
      dto.files.map(async (file) => {
        const ext = path.extname(file.filename);
        const key = `provider-covers/${providerId}/${randomUUID()}${ext}`;
        const uploadUrl = await this.storageService.generateUploadUrl(
          key,
          file.contentType,
          PROVIDER_COVER_UPLOAD_URL_EXPIRES_IN,
        );
        return {
          uploadUrl,
          method: 'PUT',
          headers: { 'Content-Type': file.contentType },
          finalUrl: key,
        };
      }),
    );

    return { uploads };
  }

  async publishProviderProfile(providerId: string, dto: PublishProfileDto) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { providerId },
    });
    if (!profile) {
      throw new NotFoundException('프로필을 먼저 생성해주세요');
    }

    return this.prisma.providerProfile.update({
      where: { providerId },
      data: { isPublished: dto.isPublished },
    });
  }
}
