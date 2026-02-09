import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as sharp from 'sharp';
import {
  GALLERY_UPLOAD_URL_EXPIRES_IN,
  GALLERY_SIGNED_URL_EXPIRES_IN,
  THUMBNAIL_MAX_WIDTH,
  THUMBNAIL_QUALITY,
} from '@sooptalk/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

@Injectable()
export class GalleryService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private notificationsService: NotificationsService,
  ) {}

  async requestUploadUrls(userId: string, dto: RequestUploadUrlDto) {
    await this.verifyInstructor(dto.programId, userId);

    const uploads = await Promise.all(
      dto.files.map(async (file) => {
        const ext = path.extname(file.filename);
        const key = `gallery/${dto.programId}/${randomUUID()}${ext}`;
        const uploadUrl = await this.storageService.generateUploadUrl(
          key,
          file.contentType,
          GALLERY_UPLOAD_URL_EXPIRES_IN,
        );
        return { key, uploadUrl };
      }),
    );

    return { uploads };
  }

  async confirmUpload(userId: string, dto: ConfirmUploadDto) {
    const program = await this.verifyInstructor(dto.programId, userId);

    const galleries = await Promise.all(
      dto.keys.map(async (imageKey) => {
        const buffer = await this.storageService.downloadObject(imageKey);

        const thumbnailBuffer = await (sharp as unknown as typeof sharp.default)(buffer)
          .resize(THUMBNAIL_MAX_WIDTH, null, { withoutEnlargement: true })
          .jpeg({ quality: THUMBNAIL_QUALITY })
          .toBuffer();

        const thumbnailKey = imageKey.replace(
          /(\.[^.]+)$/,
          '_thumb.jpg',
        );
        await this.storageService.uploadObject(
          thumbnailKey,
          thumbnailBuffer,
          'image/jpeg',
        );

        return this.prisma.gallery.create({
          data: {
            programId: dto.programId,
            imageKey,
            thumbnailKey,
            uploadedBy: userId,
          },
        });
      }),
    );

    // 예약 확정된 사용자들에게 알림 발송
    const reservations = await this.prisma.reservation.findMany({
      where: { programId: dto.programId, status: 'CONFIRMED' },
      select: { userId: true },
    });

    await Promise.all(
      reservations.map((r) =>
        this.notificationsService.createAndSend(
          r.userId,
          'GALLERY_UPLOADED',
          '새로운 활동 사진',
          `"${program.title}" 활동 사진이 업로드되었습니다.`,
          { programId: dto.programId },
        ),
      ),
    );

    return galleries;
  }

  async findByProgram(programId: string, userId: string) {
    await this.verifyAccess(programId, userId);

    const photos = await this.prisma.gallery.findMany({
      where: { programId },
      orderBy: { createdAt: 'desc' },
    });

    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => ({
        ...photo,
        imageUrl: await this.storageService.generateDownloadUrl(
          photo.imageKey,
          GALLERY_SIGNED_URL_EXPIRES_IN,
        ),
        thumbnailUrl: await this.storageService.generateDownloadUrl(
          photo.thumbnailKey,
          GALLERY_SIGNED_URL_EXPIRES_IN,
        ),
      })),
    );

    return photosWithUrls;
  }

  async delete(id: string, userId: string) {
    const gallery = await this.prisma.gallery.findUnique({
      where: { id },
      include: { program: true },
    });

    if (!gallery) {
      throw new NotFoundException('사진을 찾을 수 없습니다');
    }

    if (gallery.program.instructorId !== userId) {
      throw new ForbiddenException('본인의 프로그램 사진만 삭제할 수 있습니다');
    }

    await Promise.all([
      this.storageService.deleteObject(gallery.imageKey),
      this.storageService.deleteObject(gallery.thumbnailKey),
    ]);

    await this.prisma.gallery.delete({ where: { id } });

    return { deleted: true };
  }

  private async verifyInstructor(programId: string, userId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new NotFoundException('프로그램을 찾을 수 없습니다');
    }

    if (program.instructorId !== userId) {
      throw new ForbiddenException('해당 프로그램의 강사만 접근할 수 있습니다');
    }

    return program;
  }

  private async verifyAccess(programId: string, userId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });

    if (!program) {
      throw new NotFoundException('프로그램을 찾을 수 없습니다');
    }

    if (program.instructorId === userId) return;

    const reservation = await this.prisma.reservation.findFirst({
      where: {
        programId,
        userId,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
    });

    if (!reservation) {
      throw new ForbiddenException('해당 프로그램 참여자만 접근할 수 있습니다');
    }
  }
}
