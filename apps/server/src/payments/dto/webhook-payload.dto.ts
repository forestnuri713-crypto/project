import { IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class WebhookData {
  @IsString()
  paymentId: string;
}

export class WebhookPayloadDto {
  @ApiProperty({ description: '웹훅 이벤트 타입' })
  @IsString()
  type: string;

  @ApiProperty({ description: '웹훅 데이터' })
  @IsObject()
  data: WebhookData;
}
