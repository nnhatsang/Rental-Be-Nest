import { ApiProperty } from '@nestjs/swagger';
import { FileObjectStatus, FilePurpose, FileVisibility } from '@generated/prisma/enums';

export class FileObjectOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: FilePurpose })
  purpose!: FilePurpose;

  @ApiProperty({ enum: FileObjectStatus })
  status!: FileObjectStatus;

  @ApiProperty({ enum: FileVisibility })
  visibility!: FileVisibility;

  @ApiProperty({ example: 'return-condition.jpg' })
  originalName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType!: string;

  @ApiProperty({ example: 245760 })
  sizeBytes!: number;

  @ApiProperty({ example: '"a1b2c3"', nullable: true })
  etag!: string | null;

  @ApiProperty({ type: String, format: 'uuid' })
  uploadedBy!: string;

  @ApiProperty({ type: Date, format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: Date, format: 'date-time', nullable: true })
  deletedAt!: Date | null;

  @ApiProperty({ type: Date, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: Date, format: 'date-time' })
  updatedAt!: Date;
}

export class FileDownloadUrlOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  fileId!: string;

  @ApiProperty({ example: 'https://account-id.r2.cloudflarestorage.com/...' })
  downloadUrl!: string;

  @ApiProperty({ type: Date, format: 'date-time' })
  expiresAt!: Date;
}

export class UploadItemOutDto {
  @ApiProperty({ example: 'local-file-1' })
  clientId!: string;

  @ApiProperty({ type: FileObjectOutDto })
  file!: FileObjectOutDto;

  @ApiProperty({ example: 'https://account-id.r2.cloudflarestorage.com/...' })
  uploadUrl!: string;

  @ApiProperty({ example: 'PUT' })
  method!: 'PUT';

  @ApiProperty({ type: Object, example: { 'Content-Type': 'image/jpeg' } })
  requiredHeaders!: Record<string, string>;

  @ApiProperty({ type: Date, format: 'date-time' })
  expiresAt!: Date;
}

export class UploadOutDto {
  @ApiProperty({ type: [UploadItemOutDto] })
  files!: UploadItemOutDto[];
}

export class FileUploadPolicyOutDto {
  @ApiProperty({ enum: FilePurpose })
  purpose!: FilePurpose;

  @ApiProperty({ example: 10 })
  maxFiles!: number;

  @ApiProperty({ example: 104857600 })
  maxTotalSizeBytes!: number;

  @ApiProperty({ example: 10485760 })
  maxFileSizeBytes!: number;

  @ApiProperty({ type: [String], example: ['image/jpeg', 'image/png'] })
  allowedMimeTypes!: string[];
}

export class FileUploadPoliciesOutDto {
  @ApiProperty({ type: [FileUploadPolicyOutDto] })
  policies!: FileUploadPolicyOutDto[];
}
