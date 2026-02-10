import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { FcmModule } from './fcm/fcm.module';
import { AuthModule } from './auth/auth.module';
import { ProgramsModule } from './programs/programs.module';
import { ReservationsModule } from './reservations/reservations.module';
import { PaymentsModule } from './payments/payments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GalleryModule } from './gallery/gallery.module';
import { CronModule } from './cron/cron.module';
import { SettlementsModule } from './settlements/settlements.module';
import { AdminModule } from './admin/admin.module';
import { ProvidersModule } from './providers/providers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    StorageModule,
    FcmModule,
    AuthModule,
    ProgramsModule,
    ReservationsModule,
    PaymentsModule,
    AttendanceModule,
    NotificationsModule,
    GalleryModule,
    CronModule,
    SettlementsModule,
    AdminModule,
    ProvidersModule,
  ],
})
export class AppModule {}
