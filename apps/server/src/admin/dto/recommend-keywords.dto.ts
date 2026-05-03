import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RecommendKeywordsDto {
  @ApiProperty({ example: '아이들과 함께 봄철 숲에서 곤충과 식물을 관찰하는 체험 프로그램입니다.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;
}
