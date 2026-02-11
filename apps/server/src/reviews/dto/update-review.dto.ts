import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateReviewDto {
  @ApiPropertyOptional({ description: '별점 (1~5)', example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: '코멘트 (최대 300자)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  comment?: string;
}
