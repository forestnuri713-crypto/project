import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class ConfirmUploadDto {
  @ApiProperty({ description: '프로그램 ID' })
  @IsString()
  programId: string;

  @ApiProperty({
    description: '업로드 완료된 S3 키 목록',
    example: ['gallery/uuid/abc.jpg'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  keys: string[];
}
