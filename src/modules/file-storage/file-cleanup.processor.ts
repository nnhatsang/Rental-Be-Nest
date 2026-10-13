import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FileStorageService } from './file-storage.service';
import { FILE_CLEANUP_JOB, FILE_CLEANUP_QUEUE } from './file-cleanup.queue';

@Injectable()
@Processor(FILE_CLEANUP_QUEUE, { concurrency: 1 })
export class FileCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(FileCleanupProcessor.name);

  constructor(private readonly fileStorageService: FileStorageService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== FILE_CLEANUP_JOB) {
      return;
    }

    const cleanedCount = await this.fileStorageService.cleanupExpiredFiles();
    this.logger.log(`File cleanup completed: ${cleanedCount} file(s)`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(`File cleanup failed: ${job?.id ?? 'unknown'}`, error.stack);
  }
}
