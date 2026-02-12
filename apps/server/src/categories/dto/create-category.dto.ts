import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: '카테고리 이름', example: '야외활동' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '카테고리 슬러그', example: 'outdoor' })
  @IsString()
  @IsNotEmpty()
  slug: string;
}
