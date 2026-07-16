import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { EmailStatus } from '@generated/prisma/enums';
import { MailService } from '@modules/mail/mail.service';
import { PrismaService } from '@modules/database/prisma.service';
import {
  EMAIL_LAYOUT_KEY_EXISTED,
  EMAIL_LAYOUT_NOT_FOUND,
  EMAIL_TEMPLATE_NOT_FOUND,
  EMAIL_TEMPLATE_VARIABLE_INVALID,
  EMAIL_TEMPLATE_VARIABLE_MISSING,
} from '@/libs/constants/error.constants';
import { CreateMailLayoutDto } from './dto/create-mail-layout.dto';
import { GetAllMailTemplatesDto } from './dto/get-all-mail-templates.dto';
import { MailLayoutOutDto } from './dto/mail-layout-out.dto';
import { MailTemplateOutDto, RenderedMailTemplateOutDto, SendTestMailTemplateOutDto } from './dto/mail-template-out.dto';
import { PreviewMailTemplateDto } from './dto/preview-mail-template.dto';
import { SendTestMailTemplateDto } from './dto/send-test-mail-template.dto';
import { UpdateMailLayoutDto } from './dto/update-mail-layout.dto';
import { UpdateMailTemplateDto } from './dto/update-mail-template.dto';

export const MailTemplateKey = {
  AuthResetPassword: 'auth.reset_password',
} as const;

export type MailTemplateFallback = {
  subject: string;
  htmlBody: string;
};

type MailTemplateEntity = Awaited<ReturnType<MailTemplateService['findMailTemplateById']>>;
type ExistingMailTemplateEntity = NonNullable<MailTemplateEntity>;

@Injectable()
export class MailTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async getAllMailLayouts(query: GetAllMailTemplatesDto) {
    const { page, perPage, search, sort, isActive } = query;
    const skip = (page - 1) * perPage;
    const where: Prisma.EmailLayoutWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [{ key: { contains: search } }, { name: { contains: search } }],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.emailLayout.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ updatedAt: sort }, { id: 'asc' }],
      }),
      this.prisma.emailLayout.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toMailLayoutOut(item)),
      total,
      page,
      perPage,
    };
  }

  async getMailLayoutById(id: string): Promise<MailLayoutOutDto> {
    return this.toMailLayoutOut(await this.findExistingEmailLayoutById(id));
  }

  async createMailLayout(dto: CreateMailLayoutDto, userId: string): Promise<MailLayoutOutDto> {
    await this.ensureEmailLayoutKeyAvailable(dto.key);

    const layout = await this.prisma.emailLayout.create({
      data: {
        key: dto.key,
        name: dto.name,
        htmlLayout: dto.htmlLayout,
        isActive: dto.isActive ?? true,
        createdBy: userId,
      },
    });

    return this.toMailLayoutOut(layout);
  }

  async updateMailLayout(id: string, dto: UpdateMailLayoutDto, userId: string): Promise<MailLayoutOutDto> {
    const existingLayout = await this.findExistingEmailLayoutById(id);

    if (dto.key && dto.key !== existingLayout.key) {
      await this.ensureEmailLayoutKeyAvailable(dto.key);
    }

    const layout = await this.prisma.emailLayout.update({
      where: {
        id,
      },
      data: {
        ...(dto.key !== undefined && { key: dto.key }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.htmlLayout !== undefined && { htmlLayout: dto.htmlLayout }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedBy: userId,
      },
    });

    return this.toMailLayoutOut(layout);
  }

  async getAllMailTemplates(query: GetAllMailTemplatesDto) {
    const { page, perPage, search, sort, sortBy, isActive } = query;
    const skip = (page - 1) * perPage;
    const where: Prisma.EmailTemplateWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [{ key: { contains: search } }, { name: { contains: search } }, { subject: { contains: search } }],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.emailTemplate.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ [sortBy]: sort }, { id: 'asc' }],
        include: this.mailTemplateInclude(),
      }),
      this.prisma.emailTemplate.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toMailTemplateOut(item)),
      total,
      page,
      perPage,
    };
  }

  async getMailTemplateById(id: string): Promise<MailTemplateOutDto> {
    return this.toMailTemplateOut(await this.findExistingMailTemplateById(id));
  }

  async updateMailTemplate(id: string, dto: UpdateMailTemplateDto, userId: string): Promise<MailTemplateOutDto> {
    const existingTemplate = await this.findExistingMailTemplateById(id);
    const nextSubject = dto.subject ?? existingTemplate.subject;
    const nextHtmlBody = dto.htmlBody ?? existingTemplate.htmlBody;
    const nextVariables = dto.variables ?? this.parseVariables(existingTemplate.variables);
    const nextLayout =
      this.hasOwn(dto, 'layoutId') && dto.layoutId
        ? await this.findExistingEmailLayoutById(dto.layoutId)
        : this.hasOwn(dto, 'layoutId')
          ? null
          : existingTemplate.layout;

    this.assertTemplateVariablesValid({
      subject: nextSubject,
      htmlBody: nextHtmlBody,
      layoutHtml: nextLayout?.htmlLayout,
      variables: nextVariables,
    });

    const updatedTemplate = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(this.hasOwn(dto, 'layoutId') && { layoutId: dto.layoutId ?? null }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.htmlBody !== undefined && { htmlBody: dto.htmlBody }),
        ...(this.hasOwn(dto, 'description') && { description: dto.description ?? null }),
        ...(dto.variables !== undefined && { variables: dto.variables }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedBy: userId,
      },
      include: this.mailTemplateInclude(),
    });

    return this.toMailTemplateOut(updatedTemplate);
  }

  async previewMailTemplate(id: string, dto: PreviewMailTemplateDto): Promise<RenderedMailTemplateOutDto> {
    const template = await this.findExistingMailTemplateById(id);

    return this.renderTemplate(template, dto.payload);
  }

  async sendTestMailTemplate(id: string, dto: SendTestMailTemplateDto): Promise<SendTestMailTemplateOutDto> {
    const template = await this.findExistingMailTemplateById(id);
    const rendered = this.renderTemplate(template, dto.payload);

    try {
      await this.mailService.sendEmail({
        to: dto.toEmail,
        subject: rendered.subject,
        html: rendered.htmlBody,
      });
      await this.logEmail({
        templateId: template.id,
        toEmail: dto.toEmail,
        subject: rendered.subject,
        status: EmailStatus.SENT,
        payload: dto.payload,
      });

      return {
        success: true,
        status: EmailStatus.SENT,
        error: null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown mail error';
      await this.logEmail({
        templateId: template.id,
        toEmail: dto.toEmail,
        subject: rendered.subject,
        status: EmailStatus.FAILED,
        error: errorMessage,
        payload: dto.payload,
      });

      return {
        success: false,
        status: EmailStatus.FAILED,
        error: errorMessage,
      };
    }
  }

  async sendTemplateEmail(params: {
    key: string;
    toEmail: string;
    payload: Record<string, unknown>;
    fallback: MailTemplateFallback;
  }): Promise<void> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: {
        key: params.key,
      },
      include: this.mailTemplateInclude(),
    });
    const rendered = template?.isActive ? this.renderTemplate(template, params.payload) : params.fallback;

    try {
      await this.mailService.sendEmail({
        to: params.toEmail,
        subject: rendered.subject,
        html: rendered.htmlBody,
      });
      await this.logEmail({
        templateId: template?.id ?? null,
        toEmail: params.toEmail,
        subject: rendered.subject,
        status: EmailStatus.SENT,
        payload: params.payload,
      });
    } catch (error) {
      await this.logEmail({
        templateId: template?.id ?? null,
        toEmail: params.toEmail,
        subject: rendered.subject,
        status: EmailStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown mail error',
        payload: params.payload,
      });
      throw error;
    }
  }

  private renderTemplate(template: ExistingMailTemplateEntity, payload: Record<string, unknown>): RenderedMailTemplateOutDto {
    const variables = this.parseVariables(template.variables);
    this.assertPayloadHasVariables(template, variables, payload);
    const htmlBody = this.renderString(template.htmlBody, payload);

    return {
      subject: this.renderString(template.subject, payload),
      htmlBody: template.layout?.isActive ? this.renderLayoutString(template.layout.htmlLayout, htmlBody, payload) : htmlBody,
    };
  }

  private assertTemplateVariablesValid(input: { subject: string; htmlBody: string; layoutHtml?: string | null; variables: string[] }): void {
    const allowedVariables = new Set(input.variables);
    const placeholders = new Set([
      ...this.extractPlaceholders(input.subject),
      ...this.extractPlaceholders(input.htmlBody),
      ...this.extractPlaceholders(input.layoutHtml ?? '').filter((placeholder) => placeholder !== 'content'),
    ]);

    for (const placeholder of placeholders) {
      if (!allowedVariables.has(placeholder)) {
        throw new BadRequestException({
          ...EMAIL_TEMPLATE_VARIABLE_INVALID,
          error: {
            variable: placeholder,
          },
        });
      }
    }
  }

  private assertPayloadHasVariables(template: ExistingMailTemplateEntity, variables: string[], payload: Record<string, unknown>): void {
    const placeholders = new Set([
      ...this.extractPlaceholders(template.subject),
      ...this.extractPlaceholders(template.htmlBody),
      ...this.extractPlaceholders(template.layout?.htmlLayout ?? '').filter((placeholder) => placeholder !== 'content'),
    ]);

    for (const placeholder of placeholders) {
      if (!variables.includes(placeholder) || payload[placeholder] === undefined || payload[placeholder] === null) {
        throw new BadRequestException({
          ...EMAIL_TEMPLATE_VARIABLE_MISSING,
          error: {
            variable: placeholder,
          },
        });
      }
    }
  }

  private renderString(template: string, payload: Record<string, unknown>): string {
    return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, variable: string) => this.escapeHtml(String(payload[variable] ?? '')));
  }

  private renderLayoutString(layout: string, renderedContent: string, payload: Record<string, unknown>): string {
    return layout.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, variable: string) => {
      if (variable === 'content') {
        return renderedContent;
      }

      return this.escapeHtml(String(payload[variable] ?? ''));
    });
  }

  private extractPlaceholders(value: string): string[] {
    return [...value.matchAll(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g)].map((match) => match[1]);
  }

  private parseVariables(value: Prisma.JsonValue): string[] {
    if (value === null) {
      return [];
    }

    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
      throw new BadRequestException(EMAIL_TEMPLATE_VARIABLE_INVALID);
    }

    return value as string[];
  }

  private async logEmail(input: {
    templateId: string | null;
    toEmail: string;
    subject: string;
    status: EmailStatus;
    error?: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.emailLog.create({
      data: {
        templateId: input.templateId,
        toEmail: input.toEmail,
        subject: input.subject,
        status: input.status,
        sentAt: input.status === EmailStatus.SENT ? new Date() : null,
        error: input.error,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  }

  private async findExistingMailTemplateById(id: string): Promise<ExistingMailTemplateEntity> {
    const template = await this.findMailTemplateById(id);

    if (!template) {
      throw new NotFoundException(EMAIL_TEMPLATE_NOT_FOUND);
    }

    return template;
  }

  private async findMailTemplateById(id: string) {
    return this.prisma.emailTemplate.findUnique({
      where: {
        id,
      },
      include: this.mailTemplateInclude(),
    });
  }

  private async findExistingEmailLayoutById(id: string) {
    const layout = await this.prisma.emailLayout.findUnique({
      where: {
        id,
      },
    });

    if (!layout) {
      throw new NotFoundException(EMAIL_LAYOUT_NOT_FOUND);
    }

    return layout;
  }

  private async ensureEmailLayoutKeyAvailable(key: string): Promise<void> {
    const existingLayout = await this.prisma.emailLayout.findUnique({
      where: {
        key,
      },
      select: {
        id: true,
      },
    });

    if (existingLayout) {
      throw new BadRequestException(EMAIL_LAYOUT_KEY_EXISTED);
    }
  }

  private toMailTemplateOut(template: ExistingMailTemplateEntity): MailTemplateOutDto {
    return {
      id: template.id,
      key: template.key,
      name: template.name,
      layoutId: template.layoutId,
      layoutName: template.layout?.name ?? null,
      subject: template.subject,
      htmlBody: template.htmlBody,
      description: template.description,
      variables: this.parseVariables(template.variables),
      isActive: template.isActive,
      createdBy: template.createdBy,
      updatedBy: template.updatedBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  private mailTemplateInclude() {
    return {
      layout: true,
    } as const;
  }

  private toMailLayoutOut(layout: Awaited<ReturnType<MailTemplateService['findExistingEmailLayoutById']>>): MailLayoutOutDto {
    return {
      id: layout.id,
      key: layout.key,
      name: layout.name,
      htmlLayout: layout.htmlLayout,
      isActive: layout.isActive,
      createdBy: layout.createdBy,
      updatedBy: layout.updatedBy,
      createdAt: layout.createdAt,
      updatedAt: layout.updatedAt,
    };
  }

  private hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
}
