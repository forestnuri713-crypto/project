import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class FileInfo {
  @ApiProperty({ description: '파일명', example: 'photo1.jpg' })
  @IsString()
  filename: string;

  @ApiProperty({ description: 'Content-Type', example: 'image/jpeg' })
  @IsString()
  contentType: string;
}

export class RequestUploadUrlDto {
  @ApiProperty({ description: '프로그램 ID' })
  @IsString()
  programId: string;

  @ApiProperty({
    description: '업로드할 파일 정보 (최대 20개)',
    type: [FileInfo],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FileInfo)
  files: FileInfo[];
}
