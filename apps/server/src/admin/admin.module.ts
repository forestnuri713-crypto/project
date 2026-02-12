import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettlementsModule } from '../settlements/settlements.module';
import { PaymentsModule } from '../payments/payments.module';
import { CategoriesModule } from '../categories/categories.module';
import { AdminService } from './admin.service';
import { AdminBulkCancelService } from './admin-bulk-cancel.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [NotificationsModule, SettlementsModule, PaymentsModule, CategoriesModule],
  controllers: [AdminController],
  providers: [AdminService, AdminBulkCancelService],
})
export class AdminModule {}
