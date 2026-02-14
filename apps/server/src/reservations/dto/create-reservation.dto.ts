import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ description: '프로그램 ID' })
  @IsString()
  @IsNotEmpty()
  programId: string;

  @ApiPropertyOptional({ description: '프로그램 회차 ID (우선 사용)' })
  @IsString()
  @IsOptional()
  programScheduleId?: string;

  @ApiPropertyOptional({ description: '시작 시간 (회차 ID 없을 때 fallback용)' })
  @IsString()
  @IsOptional()
  startAt?: string;

  @ApiProperty({ description: '참여 인원', example: 2 })
  @IsInt()
  @Min(1)
  participantCount: number;
}
