import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProgramDto {
  @ApiProperty({ example: '숲속 체험 교실' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: '아이들과 함께하는 숲 체험 활동입니다.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: '서울 강남구 도곡동 일대' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ example: 37.4882 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 127.0344 })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: 30000 })
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(1)
  maxCapacity: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(0)
  minAge: number;

  @ApiProperty({ example: '2025-06-15T10:00:00.000Z' })
  @IsDateString()
  scheduleAt: string;

  @ApiPropertyOptional({ example: false, description: 'B2B 프로그램 여부' })
  @IsOptional()
  @IsBoolean()
  isB2b?: boolean;

  @ApiPropertyOptional({ example: '야외 활동 시 안전모 착용 필수, 우천 시 실내 대체 활동 진행', description: '안전 가이드' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  safetyGuide?: string;

  @ApiPropertyOptional({ example: true, description: '보험 적용 여부' })
  @IsOptional()
  @IsBoolean()
  insuranceCovered?: boolean;
}
