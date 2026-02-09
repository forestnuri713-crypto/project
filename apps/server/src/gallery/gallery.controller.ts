import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@sooptalk/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GalleryService } from './gallery.service';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

@ApiTags('Gallery')
@ApiBearerAuth()
@Controller('gallery')
export class GalleryController {
  constructor(private galleryService: GalleryService) {}

  @Post('upload-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Pre-signed 업로드 URL 요청' })
  requestUploadUrls(
    @Request() req: { user: { id: string } },
    @Body() dto: RequestUploadUrlDto,
  ) {
    return this.galleryService.requestUploadUrls(req.user.id, dto);
  }

  @Post('confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR)
  @ApiOperation({ summary: '업로드 완료 확인 + 썸네일 생성' })
  confirmUpload(
    @Request() req: { user: { id: string } },
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.galleryService.confirmUpload(req.user.id, dto);
  }

  @Get('program/:programId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '사진첩 조회 (참여자/강사만)' })
  findByProgram(
    @Request() req: { user: { id: string } },
    @Param('programId') programId: string,
  ) {
    return this.galleryService.findByProgram(programId, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR)
  @ApiOperation({ summary: '사진 삭제' })
  delete(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.galleryService.delete(id, req.user.id);
  }
}
