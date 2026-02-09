import { IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus } from '@sooptalk/shared';

export class MarkAttendanceDto {
  @ApiProperty({ description: '예약 ID' })
  @IsUUID()
  reservationId: string;

  @ApiProperty({ enum: AttendanceStatus, description: '출석 상태' })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}
