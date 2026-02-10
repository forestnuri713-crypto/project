import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@sooptalk/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { SettlementsService } from '../settlements/settlements.service';
import { AdminQueryProgramsDto } from './dto/admin-query-programs.dto';
import { RejectProgramDto } from './dto/reject-program.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { AdminQueryUsersDto } from './dto/admin-query-users.dto';
import { ChargeCashDto } from './dto/charge-cash.dto';
import { AdminQueryInstructorsDto } from './dto/admin-query-instructors.dto';
import { RejectInstructorDto } from './dto/reject-instructor.dto';
import { UpdateCertificationsDto } from './dto/update-certifications.dto';
import { QuerySettlementDto } from '../settlements/dto/query-settlement.dto';
import { GenerateSettlementDto } from '../settlements/dto/generate-settlement.dto';
import { UpdateSettlementDto } from '../settlements/dto/update-settlement.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private settlementsService: SettlementsService,
  ) {}

  // ─── Dashboard ───────────────────────────────────────

  @Get('dashboard/stats')
  @ApiOperation({ summary: '대시보드 통계' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ─── Programs ────────────────────────────────────────

  @Get('programs')
  @ApiOperation({ summary: '프로그램 목록 (관리자)' })
  findPrograms(@Query() query: AdminQueryProgramsDto) {
    return this.adminService.findPrograms(query);
  }

  @Patch('programs/:id/approve')
  @ApiOperation({ summary: '프로그램 승인' })
  approveProgram(@Param('id') id: string) {
    return this.adminService.approveProgram(id);
  }

  @Patch('programs/:id/reject')
  @ApiOperation({ summary: '프로그램 거절' })
  rejectProgram(@Param('id') id: string, @Body() dto: RejectProgramDto) {
    return this.adminService.rejectProgram(id, dto);
  }

  // ─── Settlements ─────────────────────────────────────

  @Get('settlements')
  @ApiOperation({ summary: '정산 목록' })
  findSettlements(@Query() query: QuerySettlementDto) {
    return this.settlementsService.findAll(query);
  }

  @Get('settlements/:id')
  @ApiOperation({ summary: '정산 상세' })
  findSettlement(@Param('id') id: string) {
    return this.settlementsService.findOne(id);
  }

  @Post('settlements/generate')
  @ApiOperation({ summary: '수동 정산 생성' })
  generateSettlements(@Body() dto: GenerateSettlementDto) {
    return this.settlementsService.generateSettlements(dto);
  }

  @Patch('settlements/:id/confirm')
  @ApiOperation({ summary: '정산 확인' })
  confirmSettlement(@Param('id') id: string) {
    return this.settlementsService.confirm(id);
  }

  @Patch('settlements/:id/pay')
  @ApiOperation({ summary: '정산 지급 완료' })
  paySettlement(@Param('id') id: string) {
    return this.settlementsService.markAsPaid(id);
  }

  @Patch('settlements/:id')
  @ApiOperation({ summary: '정산 메모 수정' })
  updateSettlement(@Param('id') id: string, @Body() dto: UpdateSettlementDto) {
    return this.settlementsService.update(id, dto);
  }

  // ─── Instructors ────────────────────────────────────

  @Get('instructors')
  @ApiOperation({ summary: '강사 신청 목록 (필터/페이지네이션)' })
  findInstructors(@Query() query: AdminQueryInstructorsDto) {
    return this.adminService.findInstructorApplications(query);
  }

  @Patch('instructors/:id/approve')
  @ApiOperation({ summary: '강사 승인' })
  approveInstructor(@Param('id') id: string) {
    return this.adminService.approveInstructor(id);
  }

  @Patch('instructors/:id/reject')
  @ApiOperation({ summary: '강사 거절 (사유 필수)' })
  rejectInstructor(@Param('id') id: string, @Body() dto: RejectInstructorDto) {
    return this.adminService.rejectInstructor(id, dto);
  }

  @Patch('instructors/:id/certifications')
  @ApiOperation({ summary: '강사 인증 뱃지 수정' })
  updateCertifications(@Param('id') id: string, @Body() dto: UpdateCertificationsDto) {
    return this.adminService.updateInstructorCertifications(id, dto);
  }

  // ─── Users ───────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: '사용자 목록' })
  findUsers(@Query() query: AdminQueryUsersDto) {
    return this.adminService.findUsers(query);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: '사용자 역할 변경' })
  changeUserRole(@Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.adminService.changeUserRole(id, dto);
  }

  @Post('users/:id/charge-cash')
  @ApiOperation({ summary: '사용자 알림 캐시 충전' })
  chargeCash(@Param('id') id: string, @Body() dto: ChargeCashDto) {
    return this.adminService.chargeCash(id, dto);
  }
}
