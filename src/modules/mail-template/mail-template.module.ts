import { Module } from '@nestjs/common';
import { MailModule } from '@modules/mail/mail.module';
import { MailTemplateController } from './mail-template.controller';
import { MailTemplateService } from './mail-template.service';

@Module({
  imports: [MailModule],
  controllers: [MailTemplateController],
  providers: [MailTemplateService],
  exports: [MailTemplateService],
})
export class MailTemplateModule {}
