import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SETTLEMENT_LOCK_KEY_PREFIX, SETTLEMENT_LOCK_TTL_MS } from '@sooptalk/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettlementsService } from '../settlements/settlements.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private notificationsService: NotificationsService,
    private settlementsService: SettlementsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handlePreActivityNotifications() {
    this.logger.log('사전 활동 알림 크론잡 시작');

    const now = new Date();
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const programs = await this.prisma.program.findMany({
      where: {
        scheduleAt: { gte: from, lt: to },
      },
      include: {
        reservations: {
          where: { status: 'CONFIRMED' },
          select: { userId: true },
        },
      },
    });

    for (const program of programs) {
      const redisKey = `notification:sent:pre_activity:${program.id}`;
      const alreadySent = await this.redisService.get(redisKey);

      if (alreadySent) {
        this.logger.debug(`이미 발송됨: ${program.id}`);
        continue;
      }

      for (const reservation of program.reservations) {
        await this.notificationsService.createAndSend(
          reservation.userId,
          'PRE_ACTIVITY',
          '활동 알림',
          `"${program.title}" 활동이 내일 예정되어 있습니다.`,
          { programId: program.id },
        );
      }

      // TTL 48시간으로 중복 방지
      await this.redisService.set(redisKey, '1', 48 * 60 * 60);

      this.logger.log(
        `프로그램 "${program.title}" 알림 발송 완료 (${program.reservations.length}명)`,
      );
    }

    this.logger.log('사전 활동 알림 크론잡 완료');
  }

  @Cron('0 2 * * 4')
  async handleWeeklySettlement() {
    this.logger.log('주간 정산 크론잡 시작');

    // Calculate previous week: Monday 00:00 ~ Sunday 23:59:59.999
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - dayOfWeek - 6); // Previous Monday
    lastMonday.setHours(0, 0, 0, 0);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    const lockKey = `${SETTLEMENT_LOCK_KEY_PREFIX}${lastMonday.toISOString()}`;
    const lockValue = await this.redisService.acquireLock(lockKey, SETTLEMENT_LOCK_TTL_MS);

    if (!lockValue) {
      this.logger.warn('정산 크론잡 락 획득 실패 - 다른 인스턴스에서 실행 중');
      return;
    }

    try {
      const result = await this.settlementsService.generateSettlements({
        periodStart: lastMonday.toISOString(),
        periodEnd: lastSunday.toISOString(),
      });

      this.logger.log(
        `주간 정산 완료: ${result.created}건 생성 (${lastMonday.toLocaleDateString('ko-KR')} ~ ${lastSunday.toLocaleDateString('ko-KR')})`,
      );
    } catch (error) {
      this.logger.error(
        '주간 정산 크론잡 실패',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      await this.redisService.releaseLock(lockKey, lockValue);
    }
  }
}
