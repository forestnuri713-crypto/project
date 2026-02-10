import {
  Controller,
  Put,
  Post,
  Patch,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProvidersService } from './providers.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { PresignCoverDto } from './dto/presign-cover.dto';
import { PublishProfileDto } from './dto/publish-profile.dto';

@ApiTags('Providers')
@Controller('providers')
export class ProvidersController {
  constructor(private providersService: ProvidersService) {}

  // ── 정적 경로 (파라미터 경로 위에 배치) ──

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '업체 프로필 upsert' })
  upsertProfile(
    @Request() req: { user: { id: string } },
    @Body() dto: UpsertProfileDto,
  ) {
    return this.providersService.upsertProfile(req.user.id, dto);
  }

  @Post('profile/cover-images/presign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '커버 이미지 S3 presigned upload URL 요청' })
  presignCoverImages(
    @Request() req: { user: { id: string } },
    @Body() dto: PresignCoverDto,
  ) {
    return this.providersService.presignCoverImages(req.user.id, dto);
  }

  @Patch('profile/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '업체 프로필 공개/비공개 전환' })
  togglePublish(
    @Request() req: { user: { id: string } },
    @Body() dto: PublishProfileDto,
  ) {
    return this.providersService.togglePublish(req.user.id, dto);
  }

  // ── 파라미터 경로 ──

  @Get(':id/profile')
  @ApiOperation({ summary: '업체 공개 프로필 조회' })
  getPublicProfile(@Param('id') id: string) {
    return this.providersService.getPublicProfile(id);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '업체 소속 멤버 목록 조회' })
  getMembers(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.providersService.getMembers(req.user.id, id);
  }
}
