import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  imports: [NotificationsModule],
  controllers: [GalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
