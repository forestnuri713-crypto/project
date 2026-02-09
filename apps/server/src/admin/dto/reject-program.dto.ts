import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectProgramDto {
  @ApiProperty({ example: '프로그램 내용이 부적절합니다. 수정 후 재신청 바랍니다.' })
  @IsString()
  @IsNotEmpty()
  rejectionReason: string;
}
