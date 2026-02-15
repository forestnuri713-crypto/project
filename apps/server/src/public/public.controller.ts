import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { PublicService } from './public.service';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('instructors/:slug')
  @ApiOperation({ summary: '강사 공개 프로필 조회' })
  async getInstructorProfile(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.publicService.getInstructorProfile(slug);

    if (result.redirect) {
      res.redirect(308, `/public/instructors/${result.redirect}`);
      return;
    }

    return result.profile;
  }
}
