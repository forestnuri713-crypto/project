import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { CreateProgramDto } from '../../programs/dto/create-program.dto';

export class AdminCreateProgramDto extends CreateProgramDto {
  @ApiProperty({ example: 'cluid_instructor_123', description: '강사 ID' })
  @IsString()
  @IsNotEmpty()
  instructorId: string;
}
