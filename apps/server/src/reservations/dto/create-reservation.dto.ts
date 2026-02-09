import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ description: '프로그램 ID' })
  @IsString()
  @IsNotEmpty()
  programId: string;

  @ApiProperty({ description: '참여 인원', example: 2 })
  @IsInt()
  @Min(1)
  participantCount: number;
}
