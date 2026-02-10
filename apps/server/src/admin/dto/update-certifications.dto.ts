import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, MaxLength, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { INSTRUCTOR_CERTIFICATIONS_MAX_COUNT } from '@sooptalk/shared';

class CertificationItemDto {
  @ApiProperty({ example: 'forest_guide' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: '산림교육전문가' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label: string;

  @ApiProperty({ example: 'certificate' })
  @IsString()
  @IsNotEmpty()
  iconType: string;
}

export class UpdateCertificationsDto {
  @ApiProperty({ type: [CertificationItemDto] })
  @IsArray()
  @ArrayMaxSize(INSTRUCTOR_CERTIFICATIONS_MAX_COUNT)
  @ValidateNested({ each: true })
  @Type(() => CertificationItemDto)
  certifications: CertificationItemDto[];
}
