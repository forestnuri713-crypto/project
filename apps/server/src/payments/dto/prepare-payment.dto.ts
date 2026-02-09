import { IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@sooptalk/shared';

export class PreparePaymentDto {
  @ApiProperty({ description: '예약 ID' })
  @IsUUID()
  reservationId: string;

  @ApiProperty({ enum: PaymentMethod, description: '결제 수단' })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
