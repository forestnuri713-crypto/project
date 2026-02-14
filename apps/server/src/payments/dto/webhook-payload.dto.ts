import { IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class WebhookData {
  @IsString()
  paymentId: string;

  @IsString()
  @IsOptional()
  eventId?: string;

  @IsString()
  @IsOptional()
  merchantUid?: string;
}

export class WebhookPayloadDto {
  @ApiProperty({ description: '웹훅 이벤트 타입' })
  @IsString()
  type: string;

  @ApiProperty({ description: '웹훅 데이터' })
  @IsObject()
  data: WebhookData;
}
