import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';

export const EMAIL_QUEUE = 'email';

export const EMAIL_JOB = {
  SEND_EMAIL: 'send-email',
} as const;

export type SendEmailJobData = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  messageId?: string;
};

export type EnqueueEmailOptions = {
  jobId?: string;
  priority?: number;
};

export type EnqueueEmailResult = {
  jobId: string;
};
@Injectable()
export class EmailQueue {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<SendEmailJobData>) {}

  async enqueue(data: SendEmailJobData, options: EnqueueEmailOptions = {}): Promise<EnqueueEmailResult> {
    const jobId = options.jobId ?? randomUUID();

    const job = await this.queue.add(
      EMAIL_JOB.SEND_EMAIL,
      {
        ...data,
      },
      {
        jobId,
        priority: options.priority,
      },
    );

    if (!job.id) {
      throw new Error('BullMQ không trả về jobId');
    }

    return { jobId: String(job.id) };
  }
}
