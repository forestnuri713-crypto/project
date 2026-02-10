import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@sooptalk/shared';

export class KakaoLoginDto {
  @ApiProperty({ description: '카카오 액세스 토큰' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @ApiPropertyOptional({ description: '첫 가입 시 역할 지정', enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
