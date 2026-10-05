import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';
import { FilePurpose, FileVisibility } from '@generated/prisma/enums';
import { FILE_MAX_EXPORT_SIZE_BYTES, FILE_MIME_TYPES } from '../constants/file-storage.constant';

export class CreateUploadItemDto {
  @ApiProperty({ example: 'local-file-1', maxLength: 100 })
  @IsString()
  @Length(1, 100)
  clientId!: string;

  @ApiProperty({ example: 'return-condition.jpg', maxLength: 255 })
  @IsString()
  @Length(1, 255)
  originalName!: string;

  @ApiProperty({ enum: FILE_MIME_TYPES, example: 'image/jpeg' })
  @IsString()
  @IsIn(FILE_MIME_TYPES)
  mimeType!: string;

  @ApiProperty({ example: 245760, minimum: 1, maximum: FILE_MAX_EXPORT_SIZE_BYTES })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FILE_MAX_EXPORT_SIZE_BYTES)
  sizeBytes!: number;
}

export class CreateUploadDto {
  @ApiProperty({ enum: FilePurpose, enumName: 'FilePurpose', example: FilePurpose.INSPECTION })
  @IsEnum(FilePurpose)
  purpose!: FilePurpose;

  @ApiPropertyOptional({ enum: FileVisibility, enumName: 'FileVisibility', default: FileVisibility.PRIVATE })
  @IsOptional()
  @IsEnum(FileVisibility)
  visibility?: FileVisibility;

  @ApiProperty({ type: [CreateUploadItemDto] })
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateUploadItemDto)
  files!: CreateUploadItemDto[];
}
