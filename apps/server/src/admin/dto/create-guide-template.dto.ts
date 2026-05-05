import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GuideKind } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGuideTemplateDto {
  @ApiProperty({ enum: GuideKind, description: '안내 템플릿 종류' })
  @IsEnum(GuideKind)
  kind: GuideKind;

  @ApiProperty({ example: '결제 안내 표준 템플릿', description: '관리용 템플릿 제목' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty({ example: '결제는 카드/계좌이체로 가능합니다.', description: '안내 본문' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ default: false, description: '기본 제공 템플릿 여부' })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
