import { MailService } from '@modules/mail/mail.service';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { EMAIL_JOB, EMAIL_QUEUE, SendEmailJobData } from './email-queue';

@Processor(EMAIL_QUEUE, { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<SendEmailJobData>): Promise<void> {
    if (job.name !== EMAIL_JOB.SEND_EMAIL) {
      throw new UnrecoverableError(`Email job không được hỗ trợ: ${job.name}`);
    }
    await this.mailService.sendEmail({
      to: job.data.to,
      subject: job.data.subject,
      html: job.data.html,
      text: job.data.text,
      messageId: job.data.messageId,
    });
  }
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Email job completed: ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(`Email job failed: ${job?.id ?? 'unknown'}`, error.stack);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`Email job stalled: ${jobId}`);
  }

  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error('Email worker error', error.stack);
  }
}
