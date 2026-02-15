import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateSlugDto {
  @ApiProperty({ description: '새 슬러그 (3~50자, 소문자/숫자/하이픈)', example: 'my-slug' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
  @MinLength(3)
  @MaxLength(50)
  slug: string;
}
