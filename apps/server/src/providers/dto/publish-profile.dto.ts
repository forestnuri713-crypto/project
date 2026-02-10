import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class PublishProfileDto {
  @ApiProperty({ description: '공개 여부' })
  @IsBoolean()
  isPublished: boolean;
}
