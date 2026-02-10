import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import {
  PROVIDER_COVER_MAX_COUNT,
  PROVIDER_CONTACT_LINKS_MAX_COUNT,
  PROVIDER_INTRO_SHORT_MAX_LENGTH,
} from '@sooptalk/shared';

export class UpsertProfileDto {
  @ApiProperty({ description: '업체 표시명' })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({ description: '한줄 소개 (최대 40자)' })
  @IsOptional()
  @IsString()
  @MaxLength(PROVIDER_INTRO_SHORT_MAX_LENGTH)
  introShort?: string;

  @ApiPropertyOptional({ description: '자격/인증 텍스트' })
  @IsOptional()
  @IsString()
  certificationsText?: string;

  @ApiPropertyOptional({ description: '스토리 텍스트' })
  @IsOptional()
  @IsString()
  storyText?: string;

  @ApiPropertyOptional({
    description: '커버 이미지 S3 키 배열 (최대 3개)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(PROVIDER_COVER_MAX_COUNT)
  coverImageUrls?: string[];

  @ApiPropertyOptional({
    description: '연락처 링크 배열 (최대 3개)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(PROVIDER_CONTACT_LINKS_MAX_COUNT)
  contactLinks?: string[];
}
