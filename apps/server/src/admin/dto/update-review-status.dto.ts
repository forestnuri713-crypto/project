import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ReviewStatus } from '@prisma/client';

export class UpdateReviewStatusDto {
  @ApiProperty({ enum: ReviewStatus, description: '리뷰 상태 (VISIBLE/HIDDEN)' })
  @IsEnum(ReviewStatus)
  status: ReviewStatus;
}
