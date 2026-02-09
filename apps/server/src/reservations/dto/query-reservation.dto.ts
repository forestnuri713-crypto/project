import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ReservationStatus } from '@sooptalk/shared';

export class QueryReservationDto {
  @ApiPropertyOptional({ enum: ReservationStatus, description: '예약 상태 필터' })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;
}
