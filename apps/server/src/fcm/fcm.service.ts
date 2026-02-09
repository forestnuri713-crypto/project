import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    if (!projectId) {
      this.logger.warn('Firebase 설정이 없습니다. FCM이 비활성화됩니다.');
      return;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
          privateKey: this.configService
            .get<string>('FIREBASE_PRIVATE_KEY', '')
            .replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  async sendToUser(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!admin.apps.length) return;

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data,
      });
    } catch (error) {
      this.logger.error(`FCM 발송 실패: ${error}`);
    }
  }

  async sendToMultipleUsers(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!admin.apps.length || fcmTokens.length === 0) return;

    try {
      await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: { title, body },
        data,
      });
    } catch (error) {
      this.logger.error(`FCM 멀티캐스트 발송 실패: ${error}`);
    }
  }
}
