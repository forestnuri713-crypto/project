import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PublicService } from './public.service';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('instructors/:slug')
  @ApiOperation({ summary: '강사 공개 프로필 조회' })
  getInstructorProfile(@Param('slug') slug: string) {
    return this.publicService.getInstructorProfile(slug);
  }
}
