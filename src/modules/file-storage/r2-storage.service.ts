import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { FILE_STORAGE_PROVIDER, FILE_UPLOAD_TTL_SECONDS } from './constants/file-storage.constant';

export interface R2HeadObjectResult {
  sizeBytes: number;
  mimeType: string | null;
  etag: string | null;
}

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucketName: string;
  private readonly expiresInSeconds: number;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID')?.trim();
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY')?.trim();

    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME')?.trim() ?? '';
    this.expiresInSeconds = this.configService.get<number>('R2_PRESIGN_EXPIRES_SECONDS', FILE_UPLOAD_TTL_SECONDS);

    if (accountId && accessKeyId && secretAccessKey && this.bucketName) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      this.client = null;
      this.logger.warn(`${FILE_STORAGE_PROVIDER} is not configured; file endpoints will remain unavailable`);
    }
  }

  getExpiresAt(): Date {
    return new Date(Date.now() + this.expiresInSeconds * 1000);
  }

  assertConfigured(): void {
    this.getClient();
    this.getConfiguredBucketName();
  }

  getConfiguredBucketName(): string {
    return this.getBucketName();
  }

  async createUploadUrl(input: { objectKey: string; mimeType: string }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.getBucketName(),
      Key: input.objectKey,
      ContentType: input.mimeType,
    });

    return getSignedUrl(this.getClient(), command, { expiresIn: this.expiresInSeconds });
  }

  async createDownloadUrl(input: { objectKey: string; mimeType: string; originalName: string }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.getBucketName(),
      Key: input.objectKey,
      ResponseContentType: input.mimeType,
      ResponseContentDisposition: this.buildContentDisposition(input.originalName),
    });

    return getSignedUrl(this.getClient(), command, { expiresIn: this.expiresInSeconds });
  }

  async headObject(objectKey: string): Promise<R2HeadObjectResult | null> {
    try {
      const result = await this.getClient().send(
        new HeadObjectCommand({
          Bucket: this.getBucketName(),
          Key: objectKey,
        }),
      );

      return {
        sizeBytes: Number(result.ContentLength ?? 0),
        mimeType: result.ContentType ?? null,
        etag: result.ETag ?? null,
      };
    } catch (error) {
      if (this.isMissingObjectError(error)) {
        return null;
      }

      throw error;
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: this.getBucketName(),
        Key: objectKey,
      }),
    );
  }

  private getClient(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: 'FILE_STORAGE_NOT_CONFIGURED',
        message: 'Kho lưu trữ tệp chưa được cấu hình',
      });
    }

    return this.client;
  }

  private getBucketName(): string {
    if (!this.bucketName) {
      throw new ServiceUnavailableException({
        code: 'FILE_STORAGE_NOT_CONFIGURED',
        message: 'Kho lưu trữ tệp chưa được cấu hình',
      });
    }

    return this.bucketName;
  }

  private isMissingObjectError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    return candidate.name === 'NotFound' || candidate.name === 'NoSuchKey' || candidate.$metadata?.httpStatusCode === 404;
  }

  private buildContentDisposition(originalName: string): string {
    const safeName = originalName.replace(/[\r\n"]/g, '_');
    const encodedName = encodeURIComponent(safeName).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return `inline; filename="${safeName}"; filename*=UTF-8''${encodedName}`;
  }
}
