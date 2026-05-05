import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGuideTemplateDto {
  @ApiPropertyOptional({ example: '결제 안내 표준 템플릿', description: '관리용 템플릿 제목' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ example: '결제는 카드/계좌이체로 가능합니다.', description: '안내 본문' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({ description: '기본 제공 템플릿 여부' })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
