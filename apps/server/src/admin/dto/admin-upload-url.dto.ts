import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, ValidateNested } from 'class-validator';

class FileInfo {
  @ApiProperty({ example: 'cover.jpg' })
  @IsString()
  filename: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  contentType: string;
}

export class AdminUploadUrlDto {
  @ApiProperty({ type: [FileInfo], description: '업로드할 파일 정보 (최대 20개)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FileInfo)
  files: FileInfo[];
}
