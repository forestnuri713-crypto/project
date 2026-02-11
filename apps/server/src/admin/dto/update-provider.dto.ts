import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProviderDto {
  @ApiPropertyOptional({ description: '업체명' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ description: '지역 태그', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regionTags?: string[];
}
