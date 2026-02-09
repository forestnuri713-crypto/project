import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class GenerateSettlementDto {
  @ApiProperty({ example: '2026-02-02T00:00:00.000Z', description: '정산 기간 시작일' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2026-02-08T23:59:59.999Z', description: '정산 기간 종료일' })
  @IsDateString()
  periodEnd: string;
}
