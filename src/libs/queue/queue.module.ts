import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MailModule } from '@modules/mail/mail.module';
import { EMAIL_QUEUE } from './queue.constant';
import { EmailQueueService } from './email-queue.service';
import { EmailQueueProcessor } from './email-queue.processor';

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
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          // Worker cần giữ kết nối Redis lâu dài thay vì dừng sau một số lần retry request.
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
  ],
  providers: [EmailQueueService, EmailQueueProcessor],
  exports: [EmailQueueService],
})
export class QueueModule {}



// Cách thêm một loại queue mới
// Ví dụ muốn thêm queue xử lý đơn quá hạn.
// Bước 1: Khai báo tên
// export const RENTAL_ORDER_QUEUE = 'rental-order';

// export const RENTAL_ORDER_JOB = {
//   MARK_OVERDUE: 'mark-overdue',
// } as const;
// Bước 2: Khai báo payload
// export type MarkOrderOverdueJobData = {
//   rentalOrderId: string;
// };
// Bước 3: Đăng ký queue
// Trong QueueModule:
// BullModule.registerQueue(
//   { name: EMAIL_QUEUE },
//   { name: RENTAL_ORDER_QUEUE },
// )
// Bước 4: Tạo producer
// @Injectable()
// export class RentalOrderQueueService {
//   constructor(
//     @InjectQueue(RENTAL_ORDER_QUEUE)
//     private readonly queue: Queue<MarkOrderOverdueJobData>,
//   ) {}

//   async scheduleOverdueCheck(
//     rentalOrderId: string,
//     endDate: Date,
//   ): Promise<void> {
//     await this.queue.add(
//       RENTAL_ORDER_JOB.MARK_OVERDUE,
//       { rentalOrderId },
//       {
//         jobId: `overdue-${rentalOrderId}`,
//         delay: Math.max(
//           endDate.getTime() - Date.now(),
//           0,
//         ),
//       },
//     );
//   }
// }
// Bước 5: Tạo processor
// @Processor(RENTAL_ORDER_QUEUE)
// export class RentalOrderQueueProcessor extends WorkerHost {
//   constructor(
//     private readonly prisma: PrismaService,
//   ) {
//     super();
//   }

//   async process(
//     job: Job<MarkOrderOverdueJobData>,
//   ): Promise<void> {
//     if (job.name !== RENTAL_ORDER_JOB.MARK_OVERDUE) {
//       throw new Error(`Job không hỗ trợ: ${job.name}`);
//     }

//     await this.prisma.rentalOrder.updateMany({
//       where: {
//         id: job.data.rentalOrderId,
//         status: 'RENTING',
//         endDate: {
//           lt: new Date(),
//         },
//       },
//       data: {
//         status: 'OVERDUE',
//       },
//     });
//   }
// }