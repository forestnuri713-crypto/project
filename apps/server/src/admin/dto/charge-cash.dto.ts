import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ChargeCashDto {
  @ApiProperty({ description: '충전 금액 (원)', example: 10000 })
  @IsInt()
  @Min(1)
  amount: number;
}
