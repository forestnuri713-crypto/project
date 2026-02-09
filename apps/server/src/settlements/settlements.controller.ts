import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@sooptalk/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SettlementsService } from './settlements.service';
import { QuerySettlementDto } from './dto/query-settlement.dto';

@ApiTags('Settlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private settlementsService: SettlementsService) {}

  @Get('my')
  @Roles(UserRole.INSTRUCTOR)
  @ApiOperation({ summary: '강사 본인 정산 조회' })
  findMy(
    @Request() req: { user: { id: string } },
    @Query() query: QuerySettlementDto,
  ) {
    return this.settlementsService.findByInstructor(req.user.id, query);
  }
}
