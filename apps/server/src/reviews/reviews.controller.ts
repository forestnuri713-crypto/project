import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@sooptalk/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post('reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: '리뷰 작성 (학부모만)' })
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.id, dto);
  }

  @Patch('reviews/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: '리뷰 수정 (1회, 학부모만)' })
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.updateReview(req.user.id, id, dto);
  }

  @Get('programs/:programId/reviews')
  @ApiOperation({ summary: '프로그램별 리뷰 조회 (공개)' })
  getByProgram(@Param('programId') programId: string) {
    return this.reviewsService.getReviewsByProgram(programId);
  }
}
