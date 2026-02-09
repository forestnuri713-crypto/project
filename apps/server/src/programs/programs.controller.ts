import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@sooptalk/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ProgramsService } from './programs.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { QueryProgramDto } from './dto/query-program.dto';

@ApiTags('Programs')
@Controller('programs')
export class ProgramsController {
  constructor(private programsService: ProgramsService) {}

  @Get()
  @ApiOperation({ summary: '프로그램 목록 조회 (필터, 승인된 프로그램만)' })
  findAll(@Query() query: QueryProgramDto) {
    return this.programsService.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: '강사 본인 프로그램 조회 (모든 승인 상태)' })
  findMyPrograms(@Request() req: { user: { id: string } }) {
    return this.programsService.findMyPrograms(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '프로그램 상세 조회' })
  findOne(@Param('id') id: string) {
    return this.programsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로그램 등록 (강사만)' })
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateProgramDto) {
    return this.programsService.create(req.user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로그램 수정 (해당 강사만)' })
  update(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateProgramDto,
  ) {
    return this.programsService.update(id, req.user.id, dto);
  }
}
