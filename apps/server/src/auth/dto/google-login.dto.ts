import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google ID 토큰 (credential)' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
