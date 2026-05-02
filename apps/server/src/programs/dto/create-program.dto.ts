import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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

  @ApiPropertyOptional({ example: 37.4882 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 127.0344 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

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

  @ApiPropertyOptional({ example: '2025-06-15T10:00:00.000Z', description: '단일 일정. 반복 일정 사용 시 생략 가능 (관리자 전용).' })
  @IsOptional()
  @IsDateString()
  scheduleAt?: string;

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

  @ApiPropertyOptional({ example: ['숲체험', '자연관찰'], description: '키워드 목록' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ description: '대표 이미지 S3 키' })
  @IsOptional()
  @IsString()
  coverImageKey?: string;

  @ApiPropertyOptional({ description: '갤러리 이미지 S3 키 목록' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  galleryImageKeys?: string[];

  @ApiPropertyOptional({ example: 3, description: '예약 마감일 (활동 N일 전)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  bookingDeadlineDays?: number;
}
