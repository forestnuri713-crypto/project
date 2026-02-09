import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { UserRole } from '@sooptalk/shared';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '홍길동' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '010-1234-5678' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ enum: UserRole, example: UserRole.PARENT })
  @IsEnum(UserRole)
  role: UserRole;
}
