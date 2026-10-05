import { Module } from '@nestjs/common';
import { FileStorageController } from './file-storage.controller';
import { FileUploadController } from './file-upload.controller';
import { FileStorageService } from './file-storage.service';
import { R2StorageService } from './r2-storage.service';

@Module({
  controllers: [FileStorageController, FileUploadController],
  providers: [FileStorageService, R2StorageService],
  exports: [FileStorageService],
})
export class FileStorageModule {}
