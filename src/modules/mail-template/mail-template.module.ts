import { Module } from '@nestjs/common';
import { QueueModule } from '@/libs/queue/queue.module';
import { MailTemplateController } from './mail-template.controller';
import { MailTemplateService } from './mail-template.service';

@Module({
  imports: [QueueModule],
  controllers: [MailTemplateController],
  providers: [MailTemplateService],
  exports: [MailTemplateService],
})
export class MailTemplateModule {}
