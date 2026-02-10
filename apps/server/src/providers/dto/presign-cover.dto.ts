import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PROVIDER_COVER_MAX_COUNT } from '@sooptalk/shared';

class CoverFileInfo {
  @ApiProperty({ description: '파일명', example: 'cover1.jpg' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'Content-Type', example: 'image/jpeg' })
  @IsString()
  contentType: string;
}

export class PresignCoverDto {
  @ApiProperty({
    description: `업로드할 커버 이미지 정보 (최대 ${PROVIDER_COVER_MAX_COUNT}개)`,
    type: [CoverFileInfo],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PROVIDER_COVER_MAX_COUNT)
  @ValidateNested({ each: true })
  @Type(() => CoverFileInfo)
  files: CoverFileInfo[];
}
