import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EmailStatus } from '@generated/prisma/enums';
import { PrismaService } from '@modules/database/prisma.service';
import { MailService } from '@modules/mail/mail.service';
import { Job } from 'bullmq';
import { EMAIL_JOB, EMAIL_QUEUE, EMAIL_QUEUE_OPTIONS } from './queue.constant';
import { SendEmailJobData } from './queue.type';

@Processor(EMAIL_QUEUE, { concurrency: EMAIL_QUEUE_OPTIONS.CONCURRENCY })
export class EmailQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<SendEmailJobData>): Promise<void> {
    if (job.name !== EMAIL_JOB.SEND_EMAIL) {
      throw new Error(`Email job không được hỗ trợ: ${job.name}`);
    }

    try {
      // Worker chỉ nhận nội dung đã render để không phụ thuộc vào trạng thái template lúc xử lý.
      await this.mailService.sendEmail({
        to: job.data.to,
        subject: job.data.subject,
        html: job.data.html,
        text: job.data.text,
      });

      await this.prisma.emailLog.update({
        where: { id: job.data.emailLogId },
        data: {
          status: EmailStatus.SENT,
          provider: 'smtp',
          error: null,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      const attempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;

      // Giữ PENDING trong các lần lỗi tạm thời; chỉ kết luận FAILED khi đã hết retry.
      if (isFinalAttempt) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown mail error';
        await this.prisma.emailLog.update({
          where: { id: job.data.emailLogId },
          data: {
            status: EmailStatus.FAILED,
            error: errorMessage,
            sentAt: null,
          },
        });
        this.logger.error(`Gửi email thất bại sau ${attempts} lần thử cho log ${job.data.emailLogId}`, errorMessage);
      }

      // Ném lại lỗi để BullMQ thực hiện retry/backoff theo cấu hình của job.
      throw error;
    }
  }
}
