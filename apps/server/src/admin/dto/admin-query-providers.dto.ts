import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminQueryProvidersDto {
  @ApiPropertyOptional({ description: '업체명 검색' })
  @IsOptional()
  @IsString()
  search?: string;

  /** @deprecated Use `search` instead */
  @ApiPropertyOptional({ description: '업체명 검색 (alias for search)' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** @deprecated Use `limit` instead */
  @ApiPropertyOptional({ description: 'Alias for limit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  get resolvedSearch(): string | undefined {
    return this.search ?? this.query;
  }

  get resolvedLimit(): number {
    return Math.min(this.limit ?? this.pageSize ?? 20, 100);
  }
}
