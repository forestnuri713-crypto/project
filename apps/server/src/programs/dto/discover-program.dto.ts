import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DiscoverProgramDto {
  @ApiPropertyOptional({ description: '카테고리 슬러그', example: 'outdoor' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '검색 키워드', example: '숲체험' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '지역 키워드', example: '강남' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    description: '정렬 기준',
    enum: ['latest', 'rating', 'priceAsc', 'priceDesc'],
    default: 'latest',
  })
  @IsOptional()
  @IsIn(['latest', 'rating', 'priceAsc', 'priceDesc'])
  sort?: 'latest' | 'rating' | 'priceAsc' | 'priceDesc';

  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '페이지 크기', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
