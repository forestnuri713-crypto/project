import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@sooptalk/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { VerifyQrDto } from './dto/verify-qr.dto';
import { AutoCheckinDto } from './dto/auto-checkin.dto';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: '수동 출석 체크' })
  markAttendance(@Request() req: { user: { id: string } }, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.markAttendance(req.user.id, dto);
  }

  @Post('auto-checkin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '위치+시간 기반 자동 출석 체크' })
  autoCheckin(@Request() req: { user: { id: string } }, @Body() dto: AutoCheckinDto) {
    return this.attendanceService.autoCheckin(req.user.id, dto);
  }

  @Get('qr/:reservationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'QR 코드 조회' })
  getQrCode(@Request() req: { user: { id: string } }, @Param('reservationId') reservationId: string) {
    return this.attendanceService.getQrCode(req.user.id, reservationId);
  }

  @Post('qr/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'QR 스캔 출석 확인' })
  verifyQrCode(@Request() req: { user: { id: string } }, @Body() dto: VerifyQrDto) {
    return this.attendanceService.verifyQrCode(req.user.id, dto);
  }
}
