import { MailModule } from '@modules/mail/mail.module';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EMAIL_QUEUE, EmailQueue } from './email-queue';
import { EmailProcessor } from './email.processor';

@Global()
@Module({
  imports: [
    ConfigModule,
    MailModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          // password: configService.get<string>('REDIS_PASSWORD') || undefined,
          // Worker cần giữ kết nối Redis lâu dài thay vì dừng sau một số lần retry request.
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2_000,
        },
        removeOnComplete: {
          age: 3_600,
          count: 1_000,
        },
        removeOnFail: {
          age: 86_400,
          count: 5_000,
        },
      },
    }),
  ],
  providers: [EmailQueue, EmailProcessor],
  exports: [EmailQueue],
})
export class QueueModule {}
