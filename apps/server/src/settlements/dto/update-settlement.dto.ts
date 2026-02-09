import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateSettlementDto {
  @ApiPropertyOptional({ example: '1월 3주차 정산 완료' })
  @IsOptional()
  @IsString()
  memo?: string;
}
