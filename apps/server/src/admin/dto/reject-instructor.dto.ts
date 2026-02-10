import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectInstructorDto {
  @ApiProperty({ example: '자격 서류가 불충분합니다. 보완 후 재신청 바랍니다.' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
