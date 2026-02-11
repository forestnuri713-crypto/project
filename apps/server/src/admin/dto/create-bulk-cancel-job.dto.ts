import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBulkCancelJobDto {
  @ApiProperty({ description: '취소 사유', example: '우천으로 인한 일괄 취소' })
  @IsString()
  @MaxLength(200)
  reason: string;

  @ApiPropertyOptional({ description: 'dry run 여부 (DB 변경 없이 예상값만 반환)', default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = false;
}
