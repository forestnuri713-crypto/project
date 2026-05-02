import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateProgramDto } from '../../programs/dto/create-program.dto';

export class ProgramOptionInputDto {
  @ApiProperty({ example: '오전반' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 5000, description: '기본가 대비 가격 차이 (원)' })
  @IsOptional()
  @IsInt()
  priceDiff?: number;

  @ApiPropertyOptional({ example: 10, description: '옵션 수용 인원' })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

export enum RecurrenceFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export class RecurrenceInputDto {
  @ApiProperty({ enum: RecurrenceFrequency })
  @IsEnum(RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @ApiProperty({ example: '2026-06-01', description: '반복 시작일 (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: '반복 종료일' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 12, description: '총 반복 횟수' })
  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;

  @ApiProperty({ example: '10:00', description: '시작 시각 HH:mm' })
  @IsString()
  startTime: string;

  @ApiPropertyOptional({ example: '12:00', description: '종료 시각 HH:mm' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional({ example: [1, 3, 5], description: '주간 반복 시 요일 (0=일,6=토)' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  daysOfWeek?: number[];

  @ApiPropertyOptional({ example: 15, description: '월간 반복 시 일자 (1~28)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  dayOfMonth?: number;

  @ApiProperty({ example: 20, description: '회차당 정원' })
  @IsInt()
  @Min(1)
  capacity: number;
}

export class AdminCreateProgramDto extends CreateProgramDto {
  @ApiProperty({ example: 'cluid_instructor_123', description: '강사 ID' })
  @IsString()
  @IsNotEmpty()
  instructorId: string;

  @ApiPropertyOptional({ type: [ProgramOptionInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProgramOptionInputDto)
  options?: ProgramOptionInputDto[];

  @ApiPropertyOptional({ type: RecurrenceInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceInputDto)
  recurrence?: RecurrenceInputDto;
}
