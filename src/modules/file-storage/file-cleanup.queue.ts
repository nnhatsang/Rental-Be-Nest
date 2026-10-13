import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

export const FILE_CLEANUP_QUEUE = 'file-storage-cleanup';
export const FILE_CLEANUP_JOB = 'cleanup-expired-files';

@Injectable()
export class FileCleanupQueue implements OnModuleInit {
  constructor(@InjectQueue(FILE_CLEANUP_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      FILE_CLEANUP_JOB,
      { every: 60 * 60 * 1000 },
      {
        name: FILE_CLEANUP_JOB,
        data: {},
        opts: {
          removeOnComplete: true,
          removeOnFail: { age: 24 * 60 * 60, count: 100 },
        },
      },
    );
  }
}
