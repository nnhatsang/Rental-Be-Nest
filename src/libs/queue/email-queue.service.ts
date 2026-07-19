import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_JOB, EMAIL_QUEUE, EMAIL_QUEUE_OPTIONS } from './queue.constant';
import { EnqueueEmailResult, SendEmailJobData } from './queue.type';

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<SendEmailJobData>) {}

  async enqueue(data: SendEmailJobData): Promise<EnqueueEmailResult> {
    // Dùng emailLogId làm jobId để tránh enqueue trùng cùng một lần gửi email.
    const job = await this.emailQueue.add(EMAIL_JOB.SEND_EMAIL, data, {
      jobId: data.emailLogId,
      attempts: EMAIL_QUEUE_OPTIONS.ATTEMPTS, // số lần retry
      backoff: {
        type: 'exponential', // cấp số nhân khoảng cách delay vd try1 2s try 2 4s try3 8s
        // type: "fixed" // thì khoảng cách cách nhau 3s mỗi lần retry
        delay: EMAIL_QUEUE_OPTIONS.BACKOFF_DELAY_MS, //khoảng cách tgian cac lần retry
      },
      removeOnComplete: {
        age: EMAIL_QUEUE_OPTIONS.COMPLETED_RETENTION_SECONDS, //Job hoàn thành quá 1 ngày sẽ bị xóa.
        count: EMAIL_QUEUE_OPTIONS.COMPLETED_RETENTION_COUNT,// giữ tối đa 1000 record complete
      },
      removeOnFail: {
        age: EMAIL_QUEUE_OPTIONS.FAILED_RETENTION_SECONDS,
        count: EMAIL_QUEUE_OPTIONS.FAILED_RETENTION_COUNT,
      },
    });

    if (!job.id) {
      throw new Error('BullMQ không trả về jobId cho email job');
    }

    return { jobId: String(job.id) };
  }
}
