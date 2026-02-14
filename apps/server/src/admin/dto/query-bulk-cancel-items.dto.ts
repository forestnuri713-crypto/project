import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BulkCancelItemResult } from '@prisma/client';

export class QueryBulkCancelItemsDto {
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

  @ApiPropertyOptional({ enum: BulkCancelItemResult })
  @IsOptional()
  @IsEnum(BulkCancelItemResult)
  result?: BulkCancelItemResult;

  get resolvedLimit(): number {
    return Math.min(this.limit ?? this.pageSize ?? 20, 100);
  }
}
