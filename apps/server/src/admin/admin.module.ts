import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettlementsModule } from '../settlements/settlements.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [NotificationsModule, SettlementsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
