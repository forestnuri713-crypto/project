import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@sooptalk/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { QueryReservationDto } from './dto/query-reservation.dto';

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: '예약 생성 (학부모만)' })
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateReservationDto) {
    return this.reservationsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '내 예약 목록 조회' })
  findAll(@Request() req: { user: { id: string } }, @Query() query: QueryReservationDto) {
    return this.reservationsService.findAll(req.user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '예약 상세 조회' })
  findOne(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.reservationsService.findOne(id, req.user.id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: '예약 취소' })
  cancel(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.reservationsService.cancel(id, req.user.id);
  }
}
