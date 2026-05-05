import { ApiProperty } from '@nestjs/swagger';
import { GuideKind } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpsertGuideTemplateDto {
  @ApiProperty({ enum: GuideKind, description: '안내 템플릿 종류' })
  @IsEnum(GuideKind)
  kind: GuideKind;

  @ApiProperty({ example: '활동 시 안전모를 반드시 착용해주세요...', description: '안내 본문' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
