import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { FileObjectEventType, FileObjectStatus, FilePurpose, FileVisibility, UploadBatchStatus } from '@generated/prisma/enums';
import { PrismaService } from '@modules/database/prisma.service';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { FORBIDDEN, INCORRECT_INPUT, RECORD_NOT_FOUND } from '@/libs/constants/error.constants';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  FILE_ALLOWED_MIME_TYPES_BY_PURPOSE,
  FILE_ALLOWED_EXTENSIONS_BY_MIME,
  FILE_EXTENSION_BY_MIME,
  FILE_UPLOAD_POLICY_BY_PURPOSE,
  FILE_MAX_DOCUMENT_SIZE_BYTES,
  FILE_MAX_EXPORT_SIZE_BYTES,
  FILE_MAX_IMAGE_SIZE_BYTES,
  FILE_STORAGE_PROVIDER,
  PUBLIC_FILE_PURPOSES,
  SupportedFileMimeType,
} from './constants/file-storage.constant';
import { CreateUploadDto } from './dto/create-upload.dto';
import { FileDownloadUrlOutDto, FileObjectOutDto, FileUploadPoliciesOutDto, UploadCompleteOutDto, UploadOutDto } from './dto/file-storage-out.dto';
import { R2StorageService } from './r2-storage.service';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Storage: R2StorageService,
  ) {}

  getUploadPolicies(): FileUploadPoliciesOutDto {
    return {
      policies: Object.values(FilePurpose).map((purpose) => {
        const allowedMimeTypes = [...FILE_ALLOWED_MIME_TYPES_BY_PURPOSE[purpose]];

        return {
          purpose,
          maxFiles: FILE_UPLOAD_POLICY_BY_PURPOSE[purpose].maxFiles,
          maxTotalSizeBytes: FILE_UPLOAD_POLICY_BY_PURPOSE[purpose].maxTotalSizeBytes,
          maxFileSizeBytes: Math.max(...allowedMimeTypes.map((mimeType) => this.getMaxSizeBytes(mimeType))),
          allowedMimeTypes,
        };
      }),
    };
  }

  async createUpload(dto: CreateUploadDto, actor: AuthUser): Promise<UploadOutDto> {
    this.r2Storage.assertConfigured();
    const visibility = dto.visibility ?? FileVisibility.PRIVATE;
    const policy = FILE_UPLOAD_POLICY_BY_PURPOSE[dto.purpose];
    const totalBytes = dto.files.reduce((total, file) => total + file.sizeBytes, 0);

    if (dto.files.length > policy.maxFiles) {
      throw new BadRequestException({
        ...INCORRECT_INPUT,
        code: 'UPLOAD_TOO_MANY_FILES',
        message: `Upload supports at most ${policy.maxFiles} files for ${dto.purpose}`,
      });
    }

    if (totalBytes > policy.maxTotalSizeBytes) {
      throw new BadRequestException({
        ...INCORRECT_INPUT,
        code: 'UPLOAD_TOTAL_SIZE_EXCEEDED',
        message: `Upload batch exceeds the ${Math.round(policy.maxTotalSizeBytes / (1024 * 1024))}MB total limit`,
      });
    }

    const normalizedFiles = dto.files.map((file) => {
      const mimeType = file.mimeType as SupportedFileMimeType;
      this.validateUploadRequest(dto.purpose, mimeType, file.sizeBytes, visibility, file.originalName);

      return {
        clientId: file.clientId,
        originalName: this.normalizeOriginalName(file.originalName),
        mimeType,
        sizeBytes: file.sizeBytes,
        objectKey: this.buildObjectKey(dto.purpose, actor.id, mimeType),
      };
    });

    const expiresAt = this.r2Storage.getExpiresAt();
    const created = await this.prisma.$transaction(async (transaction) => {
      const upload = await transaction.uploadBatch.create({
        data: {
          purpose: dto.purpose,
          status: UploadBatchStatus.OPEN,
          expectedFileCount: normalizedFiles.length,
          expectedTotalBytes: BigInt(totalBytes),
          uploadedBy: actor.id,
          expiresAt,
        },
      });

      const files = [];
      for (const item of normalizedFiles) {
        const file = await transaction.fileObject.create({
          data: {
            provider: FILE_STORAGE_PROVIDER,
            bucket: this.r2Storage.getConfiguredBucketName(),
            objectKey: item.objectKey,
            purpose: dto.purpose,
            status: FileObjectStatus.PENDING,
            visibility,
            originalName: item.originalName,
            mimeType: item.mimeType,
            sizeBytes: BigInt(item.sizeBytes),
            uploadedBy: actor.id,
            uploadBatchId: upload.id,
            expiresAt,
          },
        });

        await transaction.fileObjectEvent.create({
          data: {
            fileId: file.id,
            actorId: actor.id,
            event: FileObjectEventType.PRESIGNED,
            metadata: this.jsonValue({ uploadId: upload.id, purpose: dto.purpose, mimeType: item.mimeType, sizeBytes: item.sizeBytes }),
          },
        });

        files.push({ clientId: item.clientId, file });
      }

      return { upload, files };
    });

    try {
      const files = await Promise.all(
        created.files.map(async ({ clientId, file }) => ({
          clientId,
          file: this.toFileObjectOut(file),
          uploadUrl: await this.r2Storage.createUploadUrl({ objectKey: file.objectKey, mimeType: file.mimeType }),
          method: 'PUT' as const,
          requiredHeaders: { 'Content-Type': file.mimeType },
          expiresAt,
        })),
      );

      return {
        uploadId: created.upload.id,
        purpose: created.upload.purpose,
        status: created.upload.status,
        expectedFileCount: created.upload.expectedFileCount,
        expectedTotalBytes: Number(created.upload.expectedTotalBytes),
        expiresAt: created.upload.expiresAt,
        files,
      };
    } catch (error) {
      await this.markUploadFailed(created.upload.id, actor.id, 'presign_failed');
      throw error;
    }
  }

  async completeUploadBatch(uploadId: string, actor: AuthUser): Promise<UploadCompleteOutDto> {
    const upload = await this.findUpload(uploadId);
    this.assertCanManageUpload(upload.uploadedBy, actor);

    if (upload.status === UploadBatchStatus.COMPLETED) {
      return this.toUploadCompleteOut(upload);
    }

    if (upload.status !== UploadBatchStatus.OPEN) {
      throw new BadRequestException({
        code: 'UPLOAD_NOT_OPEN',
        message: 'Upload is no longer open',
      });
    }

    if (upload.expiresAt.getTime() <= Date.now()) {
      await this.markUploadExpired(upload.id, actor.id);
      throw new BadRequestException({
        code: 'UPLOAD_EXPIRED',
        message: 'Upload has expired',
      });
    }

    const incompleteFiles = upload.files.filter((file) => file.status !== FileObjectStatus.READY);
    if (incompleteFiles.length > 0) {
      throw new BadRequestException({
        code: 'UPLOAD_INCOMPLETE',
        message: 'Some files have not been completed',
        details: incompleteFiles.map((file) => ({ fileId: file.id, status: file.status })),
      });
    }

    const completedAt = new Date();
    const completedUpload = await this.prisma.uploadBatch.update({
      where: { id: upload.id },
      data: { status: UploadBatchStatus.COMPLETED, completedAt },
      include: { files: true },
    });

    return this.toUploadCompleteOut(completedUpload);
  }

  async cancelUpload(uploadId: string, actor: AuthUser): Promise<UploadCompleteOutDto> {
    const upload = await this.findUpload(uploadId);
    this.assertCanManageUpload(upload.uploadedBy, actor);

    if (upload.status === UploadBatchStatus.COMPLETED) {
      throw new BadRequestException({
        code: 'UPLOAD_ALREADY_COMPLETED',
        message: 'Completed uploads cannot be cancelled',
      });
    }

    await Promise.all(upload.files.map((file) => this.deleteObjectBestEffort(file.objectKey)));

    const cancelledUpload = await this.prisma.$transaction(async (transaction) => {
      await transaction.fileObject.updateMany({
        where: { uploadBatchId: upload.id, deletedAt: null },
        data: { status: FileObjectStatus.DELETED, deletedAt: new Date() },
      });

      return transaction.uploadBatch.update({
        where: { id: upload.id },
        data: { status: UploadBatchStatus.CANCELLED, cancelledAt: new Date() },
        include: { files: true },
      });
    });

    return this.toUploadCompleteOut(cancelledUpload);
  }

  async completeUpload(fileId: string, actor: AuthUser): Promise<FileObjectOutDto> {
    const file = await this.findActiveFile(fileId);
    this.assertCanComplete(file.uploadedBy, actor.id);

    if (file.status === FileObjectStatus.READY) {
      return this.toFileObjectOut(file);
    }

    if (file.status !== FileObjectStatus.PENDING) {
      throw new BadRequestException({
        code: 'FILE_UPLOAD_NOT_READY',
        message: 'Tệp không ở trạng thái có thể hoàn tất',
      });
    }

    if (file.expiresAt.getTime() <= Date.now()) {
      await this.markFailed(file.id, actor.id, 'upload_expired');
      throw new BadRequestException({
        code: 'FILE_UPLOAD_EXPIRED',
        message: 'Phiên tải tệp đã hết hạn',
      });
    }

    const object = await this.r2Storage.headObject(file.objectKey);
    if (!object) {
      await this.markFailed(file.id, actor.id, 'object_not_found');
      throw new BadRequestException({
        code: 'FILE_UPLOAD_NOT_READY',
        message: 'Không tìm thấy object trên R2; hãy tải tệp lên trước khi complete',
      });
    }

    if (object.sizeBytes !== Number(file.sizeBytes) || object.mimeType !== file.mimeType) {
      await this.markFailed(file.id, actor.id, 'object_metadata_mismatch');
      await this.deleteObjectBestEffort(file.objectKey);
      throw new BadRequestException({
        code: 'FILE_UPLOAD_INVALID',
        message: 'Kích thước hoặc Content-Type của object không khớp metadata đã đăng ký',
      });
    }

    const completedFile = await this.prisma.$transaction(async (transaction) => {
      const updatedFile = await transaction.fileObject.update({
        where: { id: file.id },
        data: {
          status: FileObjectStatus.READY,
          etag: object.etag,
          completedAt: new Date(),
        },
      });

      await transaction.fileObjectEvent.create({
        data: {
          fileId: file.id,
          actorId: actor.id,
          event: FileObjectEventType.UPLOAD_COMPLETED,
          metadata: this.jsonValue({ etag: object.etag, sizeBytes: object.sizeBytes }),
        },
      });

      return updatedFile;
    });

    return this.toFileObjectOut(completedFile);
  }

  async createDownloadUrl(fileId: string, actor: AuthUser): Promise<FileDownloadUrlOutDto> {
    const file = await this.findActiveFile(fileId);
    this.assertCanRead(file, actor);

    if (file.status !== FileObjectStatus.READY) {
      throw new BadRequestException({
        code: 'FILE_UPLOAD_NOT_READY',
        message: 'Chỉ có thể tạo link tải cho tệp đã hoàn tất',
      });
    }

    const expiresAt = this.r2Storage.getExpiresAt();
    const downloadUrl = await this.r2Storage.createDownloadUrl({
      objectKey: file.objectKey,
      mimeType: file.mimeType,
      originalName: file.originalName,
    });

    await this.prisma.fileObjectEvent.create({
      data: {
        fileId: file.id,
        actorId: actor.id,
        event: FileObjectEventType.DOWNLOAD_URL_ISSUED,
        metadata: this.jsonValue({ expiresAt }),
      },
    });

    return { fileId: file.id, downloadUrl, expiresAt };
  }

  async deleteFile(fileId: string, actor: AuthUser): Promise<FileObjectOutDto> {
    const file = await this.findActiveFile(fileId);
    this.assertCanDelete(file, actor);

    await this.r2Storage.deleteObject(file.objectKey);

    const deletedFile = await this.prisma.$transaction(async (transaction) => {
      const updatedFile = await transaction.fileObject.update({
        where: { id: file.id },
        data: {
          status: FileObjectStatus.DELETED,
          deletedAt: new Date(),
        },
      });

      await transaction.fileObjectEvent.create({
        data: {
          fileId: file.id,
          actorId: actor.id,
          event: FileObjectEventType.DELETED,
        },
      });

      return updatedFile;
    });

    return this.toFileObjectOut(deletedFile);
  }

  private validateUploadRequest(
    purpose: FilePurpose,
    mimeType: SupportedFileMimeType,
    sizeBytes: number,
    visibility?: FileVisibility,
    originalName?: string,
  ): void {
    const allowedMimeTypes = FILE_ALLOWED_MIME_TYPES_BY_PURPOSE[purpose];
    if (!allowedMimeTypes?.includes(mimeType)) {
      throw new BadRequestException({
        ...INCORRECT_INPUT,
        message: `MIME type ${mimeType} không được phép cho mục đích ${purpose}`,
      });
    }

    const maxSize = this.getMaxSizeBytes(mimeType);
    if (sizeBytes > maxSize) {
      throw new BadRequestException({
        ...INCORRECT_INPUT,
        message: `Tệp vượt quá giới hạn ${Math.round(maxSize / (1024 * 1024))}MB`,
      });
    }

    const extension = originalName ? extname(originalName).slice(1).toLowerCase() : '';
    if (extension && !FILE_ALLOWED_EXTENSIONS_BY_MIME[mimeType].includes(extension)) {
      throw new BadRequestException({
        ...INCORRECT_INPUT,
        message: `Phần mở rộng .${extension} không khớp với MIME type ${mimeType}`,
      });
    }

    if (visibility === FileVisibility.PUBLIC && !PUBLIC_FILE_PURPOSES.has(purpose)) {
      throw new BadRequestException({
        ...INCORRECT_INPUT,
        message: 'Chỉ media catalog/CMS mới được phép đánh dấu public',
      });
    }
  }

  private getMaxSizeBytes(mimeType: SupportedFileMimeType): number {
    if (mimeType.startsWith('image/')) {
      return FILE_MAX_IMAGE_SIZE_BYTES;
    }

    if (mimeType === 'application/pdf') {
      return FILE_MAX_DOCUMENT_SIZE_BYTES;
    }

    return FILE_MAX_EXPORT_SIZE_BYTES;
  }

  private buildObjectKey(purpose: FilePurpose, actorId: string, mimeType: SupportedFileMimeType): string {
    const extension = FILE_EXTENSION_BY_MIME[mimeType];
    return `uploads/${purpose.toLowerCase()}/${actorId}/${randomUUID()}.${extension}`;
  }

  private normalizeOriginalName(originalName: string): string {
    const normalized = originalName.replace(/[\\/\r\n]/g, '_').trim();
    return normalized || 'upload';
  }

  private async findUpload(uploadId: string) {
    const upload = await this.prisma.uploadBatch.findFirst({
      where: { id: uploadId },
      include: {
        files: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!upload) {
      throw new NotFoundException(RECORD_NOT_FOUND);
    }

    return upload;
  }

  private async findActiveFile(fileId: string) {
    const file = await this.prisma.fileObject.findFirst({
      where: {
        id: fileId,
        deletedAt: null,
      },
    });

    if (!file) {
      throw new NotFoundException(RECORD_NOT_FOUND);
    }

    return file;
  }

  private assertCanComplete(uploadedBy: string, actorId: string): void {
    if (uploadedBy !== actorId) {
      throw new ForbiddenException(FORBIDDEN);
    }
  }

  private assertCanManageUpload(uploadedBy: string, actor: AuthUser): void {
    const privileged = actor.roles.some((role) => role === 'ADMIN' || role === 'MANAGER');
    if (!privileged && uploadedBy !== actor.id) {
      throw new ForbiddenException(FORBIDDEN);
    }
  }

  private assertCanRead(file: { uploadedBy: string }, actor: AuthUser): void {
    const privileged = actor.roles.some((role) => role === 'ADMIN' || role === 'MANAGER');
    if (!privileged && file.uploadedBy !== actor.id) {
      throw new ForbiddenException(FORBIDDEN);
    }
  }

  private assertCanDelete(file: { uploadedBy: string }, actor: AuthUser): void {
    const privileged = actor.roles.some((role) => role === 'ADMIN' || role === 'MANAGER');
    if (!privileged && file.uploadedBy !== actor.id) {
      throw new ForbiddenException(FORBIDDEN);
    }
  }

  private async markFailed(fileId: string, actorId: string, reason: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.fileObject.updateMany({
          where: { id: fileId, status: { not: FileObjectStatus.READY } },
          data: { status: FileObjectStatus.FAILED },
        });

        await transaction.fileObjectEvent.create({
          data: {
            fileId,
            actorId,
            event: FileObjectEventType.FAILED,
            metadata: this.jsonValue({ reason }),
          },
        });
      });
    } catch (error) {
      this.logger.error(`Failed to persist file failure event for ${fileId}`, error instanceof Error ? error.stack : undefined);
    }
  }

  private async markUploadFailed(uploadId: string, actorId: string, reason: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.uploadBatch.updateMany({
          where: { id: uploadId, status: UploadBatchStatus.OPEN },
          data: { status: UploadBatchStatus.FAILED },
        });

        const files = await transaction.fileObject.findMany({ where: { uploadBatchId: uploadId } });
        await transaction.fileObject.updateMany({
          where: { uploadBatchId: uploadId, status: FileObjectStatus.PENDING },
          data: { status: FileObjectStatus.FAILED },
        });

        if (files.length > 0) {
          await transaction.fileObjectEvent.createMany({
            data: files.map((file) => ({
              fileId: file.id,
              actorId,
              event: FileObjectEventType.FAILED,
              metadata: this.jsonValue({ reason, uploadId }),
            })),
          });
        }
      });
    } catch (error) {
      this.logger.error(`Failed to persist upload failure for ${uploadId}`, error instanceof Error ? error.stack : undefined);
    }
  }

  private async markUploadExpired(uploadId: string, actorId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.uploadBatch.updateMany({
        where: { id: uploadId, status: UploadBatchStatus.OPEN },
        data: { status: UploadBatchStatus.EXPIRED },
      });

      const files = await transaction.fileObject.findMany({ where: { uploadBatchId: uploadId, status: FileObjectStatus.PENDING } });
      await transaction.fileObject.updateMany({
        where: { uploadBatchId: uploadId, status: FileObjectStatus.PENDING },
        data: { status: FileObjectStatus.FAILED },
      });

      if (files.length > 0) {
        await transaction.fileObjectEvent.createMany({
          data: files.map((file) => ({
            fileId: file.id,
            actorId,
            event: FileObjectEventType.FAILED,
            metadata: this.jsonValue({ reason: 'upload_expired', uploadId }),
          })),
        });
      }
    });
  }

  private async deleteObjectBestEffort(objectKey: string): Promise<void> {
    try {
      await this.r2Storage.deleteObject(objectKey);
    } catch (error) {
      this.logger.warn(`Failed to delete invalid R2 object ${objectKey}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private toFileObjectOut(file: {
    id: string;
    purpose: FilePurpose;
    status: FileObjectStatus;
    visibility: FileVisibility;
    originalName: string;
    mimeType: string;
    sizeBytes: bigint;
    etag: string | null;
    uploadedBy: string;
    expiresAt: Date;
    completedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): FileObjectOutDto {
    return {
      id: file.id,
      purpose: file.purpose,
      status: file.status,
      visibility: file.visibility,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: Number(file.sizeBytes),
      etag: file.etag,
      uploadedBy: file.uploadedBy,
      expiresAt: file.expiresAt,
      completedAt: file.completedAt,
      deletedAt: file.deletedAt,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  private toUploadCompleteOut(upload: {
    id: string;
    purpose: FilePurpose;
    status: UploadBatchStatus;
    completedAt: Date | null;
    files: Array<{
      id: string;
      purpose: FilePurpose;
      status: FileObjectStatus;
      visibility: FileVisibility;
      originalName: string;
      mimeType: string;
      sizeBytes: bigint;
      etag: string | null;
      uploadedBy: string;
      expiresAt: Date;
      completedAt: Date | null;
      deletedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): UploadCompleteOutDto {
    return {
      uploadId: upload.id,
      purpose: upload.purpose,
      status: upload.status,
      completedAt: upload.completedAt,
      files: upload.files.map((file) => this.toFileObjectOut(file)),
    };
  }

  private jsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
