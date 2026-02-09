import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryProgramDto {
  @ApiPropertyOptional({ description: '지역 키워드', example: '강남' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: '시작 날짜', example: '2025-06-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: '종료 날짜', example: '2025-06-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: '최소 연령 이하 프로그램', example: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minAge?: number;
}
