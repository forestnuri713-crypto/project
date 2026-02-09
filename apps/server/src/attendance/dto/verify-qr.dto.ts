import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyQrDto {
  @ApiProperty({ description: 'QR 코드' })
  @IsString()
  qrCode: string;
}
