import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ description: '예약 ID' })
  @IsString()
  @IsNotEmpty()
  reservationId: string;

  @ApiProperty({ description: '별점 (1~5)', example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: '코멘트 (최대 300자)', example: '아이가 정말 좋아했어요!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  comment: string;
}
