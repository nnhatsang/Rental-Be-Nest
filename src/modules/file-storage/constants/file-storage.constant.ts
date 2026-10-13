import { FilePurpose } from '@generated/prisma/enums';

export const FILE_MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const FILE_MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

export const FILE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type SupportedFileMimeType = (typeof FILE_MIME_TYPES)[number];

export const FILE_ALLOWED_MIME_TYPES_BY_PURPOSE: Record<FilePurpose, readonly SupportedFileMimeType[]> = {
  [FilePurpose.INSPECTION]: ['image/jpeg', 'image/png', 'image/webp'],
  [FilePurpose.INCIDENT]: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  [FilePurpose.PAYMENT_PROOF]: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  [FilePurpose.PRODUCT_MEDIA]: ['image/jpeg', 'image/png', 'image/webp'],
  [FilePurpose.ASSET_MEDIA]: ['image/jpeg', 'image/png', 'image/webp'],
  [FilePurpose.DELIVERY_PROOF]: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  [FilePurpose.CONTRACT_DOCUMENT]: ['application/pdf'],
  [FilePurpose.CONTRIBUTOR_DOCUMENT]: ['image/jpeg', 'image/png', 'application/pdf'],
  [FilePurpose.REPORT_EXPORT]: ['application/pdf'],
  [FilePurpose.CMS_MEDIA]: ['image/jpeg', 'image/png', 'image/webp'],
  [FilePurpose.CUSTOMER_IDENTITY]: ['image/jpeg', 'image/png', 'image/webp'],
};

export const FILE_EXTENSION_BY_MIME: Record<SupportedFileMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const FILE_ALLOWED_EXTENSIONS_BY_MIME: Record<SupportedFileMimeType, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
};

export const FILE_STORAGE_PROVIDER = 'R2';
export const FILE_UPLOAD_TTL_SECONDS = 900;

export interface FileUploadPolicy {
  maxFiles: number;
  maxTotalSizeBytes: number;
}

export const FILE_UPLOAD_POLICY_BY_PURPOSE: Record<FilePurpose, FileUploadPolicy> = {
  [FilePurpose.INSPECTION]: { maxFiles: 10, maxTotalSizeBytes: 100 * 1024 * 1024 },
  [FilePurpose.INCIDENT]: { maxFiles: 10, maxTotalSizeBytes: 100 * 1024 * 1024 },
  [FilePurpose.PAYMENT_PROOF]: { maxFiles: 1, maxTotalSizeBytes: 20 * 1024 * 1024 },
  [FilePurpose.PRODUCT_MEDIA]: { maxFiles: 10, maxTotalSizeBytes: 100 * 1024 * 1024 },
  [FilePurpose.ASSET_MEDIA]: { maxFiles: 10, maxTotalSizeBytes: 100 * 1024 * 1024 },
  [FilePurpose.DELIVERY_PROOF]: { maxFiles: 10, maxTotalSizeBytes: 100 * 1024 * 1024 },
  [FilePurpose.CONTRACT_DOCUMENT]: { maxFiles: 10, maxTotalSizeBytes: 100 * 1024 * 1024 },
  [FilePurpose.CONTRIBUTOR_DOCUMENT]: { maxFiles: 10, maxTotalSizeBytes: 100 * 1024 * 1024 },
  [FilePurpose.REPORT_EXPORT]: { maxFiles: 10, maxTotalSizeBytes: 100 * 1024 * 1024 },
  [FilePurpose.CMS_MEDIA]: { maxFiles: 10, maxTotalSizeBytes: 100 * 1024 * 1024 },
  [FilePurpose.CUSTOMER_IDENTITY]: { maxFiles: 2, maxTotalSizeBytes: 20 * 1024 * 1024 },
};
