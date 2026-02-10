import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AutoCheckinDto {
  @ApiProperty({ description: '예약 ID' })
  @IsString()
  @IsNotEmpty()
  reservationId: string;

  @ApiProperty({ description: '현재 위도' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ description: '현재 경도' })
  @IsNumber()
  longitude: number;
}
