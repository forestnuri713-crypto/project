import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NOTIFICATION_COST_PER_MESSAGE } from '@sooptalk/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from '../fcm/fcm.service';

const PAID_NOTIFICATION_TYPES: NotificationType[] = ['PRE_ACTIVITY', 'GALLERY_UPLOADED'];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private fcmService: FcmService,
  ) {}

  async createAndSend(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    // For paid notification types, check instructor cash balance
    if (PAID_NOTIFICATION_TYPES.includes(type) && data?.programId) {
      const program = await this.prisma.program.findUnique({
        where: { id: data.programId },
        select: { instructorId: true },
      });

      if (program) {
        const instructor = await this.prisma.user.findUnique({
          where: { id: program.instructorId },
          select: { id: true, messageCashBalance: true, fcmToken: true },
        });

        if (instructor) {
          if (instructor.messageCashBalance < NOTIFICATION_COST_PER_MESSAGE) {
            this.logger.warn(
              `캐시 잔액 부족으로 알림 발송 차단: instructorId=${instructor.id}, balance=${instructor.messageCashBalance}`,
            );

            // Send FCM to instructor about insufficient balance
            if (instructor.fcmToken) {
              await this.fcmService.sendToUser(
                instructor.fcmToken,
                '캐시 잔액 부족',
                `알림 발송에 필요한 캐시가 부족합니다. 현재 잔액: ${instructor.messageCashBalance}원. 충전 후 이용해주세요.`,
              );
            }

            return null;
          }

          // Deduct cash balance
          await this.prisma.user.update({
            where: { id: instructor.id },
            data: {
              messageCashBalance: { decrement: NOTIFICATION_COST_PER_MESSAGE },
            },
          });
        }
      }
    }

    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, data },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (user?.fcmToken) {
      await this.fcmService.sendToUser(user.fcmToken, title, body, data);
    }

    return notification;
  }

  async findAllForUser(userId: string, cursor?: string, limit = 20) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
    });

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { items, nextCursor, hasMore };
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}
