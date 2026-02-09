import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class ChangeRoleDto {
  @ApiProperty({ enum: UserRole, example: 'INSTRUCTOR' })
  @IsEnum(UserRole)
  role: UserRole;
}
