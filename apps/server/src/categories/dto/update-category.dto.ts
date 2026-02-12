import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: '카테고리 이름', example: '야외활동' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: '카테고리 슬러그', example: 'outdoor' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slug?: string;
}
