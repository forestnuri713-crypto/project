import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class KakaoLoginDto {
  @ApiProperty({ description: '카카오 액세스 토큰' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
