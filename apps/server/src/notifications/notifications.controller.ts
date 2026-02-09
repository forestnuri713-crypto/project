import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: '내 알림 목록 조회' })
  findAll(
    @Request() req: { user: { id: string } },
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationsService.findAllForUser(
      req.user.id,
      query.cursor,
      query.limit,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: '읽지 않은 알림 수 조회' })
  async getUnreadCount(@Request() req: { user: { id: string } }) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: '알림 읽음 처리' })
  markAsRead(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: '모든 알림 읽음 처리' })
  markAllAsRead(@Request() req: { user: { id: string } }) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
