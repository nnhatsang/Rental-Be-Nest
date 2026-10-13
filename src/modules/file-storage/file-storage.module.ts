import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FileStorageController } from './file-storage.controller';
import { FileUploadController } from './file-upload.controller';
import { FILE_CLEANUP_QUEUE, FileCleanupQueue } from './file-cleanup.queue';
import { FileCleanupProcessor } from './file-cleanup.processor';
import { FileStorageService } from './file-storage.service';
import { R2StorageService } from './r2-storage.service';

@Module({
  imports: [BullModule.registerQueue({ name: FILE_CLEANUP_QUEUE })],
  controllers: [FileStorageController, FileUploadController],
  providers: [FileStorageService, R2StorageService, FileCleanupQueue, FileCleanupProcessor],
  exports: [FileStorageService],
})
export class FileStorageModule {}
