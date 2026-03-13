import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { UserRole } from '@sooptalk/shared';

export class GoogleLoginDto {
  @ApiPropertyOptional({ description: '구글 액세스 토큰 (직접 전달 시)' })
  @ValidateIf((o) => !o.code)
  @IsString()
  @IsNotEmpty()
  accessToken?: string;

  @ApiPropertyOptional({ description: '구글 인가 코드 (Authorization Code 방식)' })
  @ValidateIf((o) => !o.accessToken)
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional({ description: '인가 코드 발급 시 사용한 리다이렉트 URI' })
  @ValidateIf((o) => !!o.code)
  @IsString()
  @IsNotEmpty()
  redirectUri?: string;

  @ApiPropertyOptional({ description: '첫 가입 시 역할 지정', enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
