import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { InstructorStatus } from '@prisma/client';

export class AdminQueryInstructorsDto {
  @ApiPropertyOptional({ enum: InstructorStatus })
  @IsOptional()
  @IsEnum(InstructorStatus)
  instructorStatus?: InstructorStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

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

  get resolvedLimit(): number {
    return Math.min(this.limit ?? 20, 100);
  }
}
