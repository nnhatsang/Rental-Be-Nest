import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '@modules/database/prisma.service';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  EMAIL_LAYOUT_IN_USE,
  EMAIL_LAYOUT_KEY_EXISTED,
  EMAIL_LAYOUT_NOT_FOUND,
  EMAIL_TEMPLATE_NOT_FOUND,
  EMAIL_TEMPLATE_VARIABLE_INVALID,
  EMAIL_TEMPLATE_VARIABLE_MISSING,
} from '@/libs/constants/error.constants';
import { EmailQueue } from '@/libs/queue/email-queue';

import { mailTemplateCatalog } from './const/mail-template.catalog';
import { CreateMailLayoutDto } from './dto/create-mail-layout.dto';
import { GetAllMailLayoutsDto } from './dto/get-all-mail-layouts.dto';
import { GetAllMailTemplatesDto } from './dto/get-all-mail-templates.dto';
import { MailLayoutOutDto } from './dto/mail-layout-out.dto';
import { MailTemplateOutDto, RenderedMailTemplateOutDto, SendTestMailTemplateOutDto } from './dto/mail-template-out.dto';
import { PreviewMailTemplateDto } from './dto/preview-mail-template.dto';
import { SendTestMailTemplateDto } from './dto/send-test-mail-template.dto';
import { UpdateMailLayoutDto } from './dto/update-mail-layout.dto';
import { UpdateMailTemplateDto } from './dto/update-mail-template.dto';

export type MailTemplateFallback = {
  subject: string;
  htmlBody: string;
};

type MailTemplateEntity = Awaited<ReturnType<MailTemplateService['findMailTemplateById']>>;
type ExistingMailTemplateEntity = NonNullable<MailTemplateEntity>;
type MailLayoutRecord = {
  id: string;
  key: string;
  name: string;
  htmlLayout: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { templates: number };
};

const emptyVariableSpanPattern = /<span\b[^>]*data-email-variable\s*=\s*["']\s*["'][^>]*>\s*{{\s*}}\s*<\/span>/gi;
const legacyVariableAttributePattern =
  /(\b(?:href|src)\s*=\s*["'])&lt;span\b[^>]*data-email-variable\s*=\s*["'][^>]*(?:>|&gt;)\s*{{\s*([a-zA-Z0-9_.-]+)\s*}}\s*(?=["'])/gi;
const legacyTokenAnchorEndPattern = /(<a\b[^>]*\bclass\s*=\s*["'][^"']*\bemail-variable-token\b[^"']*["'][^>]*?)\s*&gt;([\s\S]*?)<\/a>/gi;
const legacyTokenAnchorClassPattern = /(<a\b[^>]*?)\sclass\s*=\s*(["'])([^"']*\bemail-variable-token\b[^"']*)\2/gi;

@Injectable()
export class MailTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueue,
    private readonly configService: ConfigService,
  ) {}

  async getAllMailLayouts(query: GetAllMailLayoutsDto) {
    const { page, perPage, search, sort, sortBy, isActive } = query;
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
        orderBy: [{ [sortBy]: sort }, { id: 'asc' }],
        include: {
          _count: {
            select: { templates: true },
          },
        },
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
    this.assertLayoutValid(dto.htmlLayout);

    const layout = await this.prisma.emailLayout.create({
      data: {
        key: dto.key,
        name: dto.name,
        htmlLayout: dto.htmlLayout,
        isActive: dto.isActive ?? true,
        createdBy: userId,
      },
    });

    return this.toMailLayoutOut(await this.findExistingEmailLayoutById(layout.id));
  }

  async deleteMailLayout(id: string): Promise<{ success: true }> {
    const existingLayout = await this.findExistingEmailLayoutById(id);

    if (existingLayout._count.templates > 0) {
      throw new ConflictException(EMAIL_LAYOUT_IN_USE);
    }

    try {
      await this.prisma.emailLayout.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(EMAIL_LAYOUT_IN_USE);
      }

      throw error;
    }

    return { success: true };
  }

  async updateMailLayout(id: string, dto: UpdateMailLayoutDto, userId: string): Promise<MailLayoutOutDto> {
    const existingLayout = await this.findExistingEmailLayoutById(id);

    if (dto.key && dto.key !== existingLayout.key) {
      await this.ensureEmailLayoutKeyAvailable(dto.key);
    }

    if (dto.htmlLayout !== undefined) {
      this.assertLayoutValid(dto.htmlLayout);
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

    return this.toMailLayoutOut(await this.findExistingEmailLayoutById(layout.id));
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

  async getMailTemplateCatalog() {
    const templates = await this.prisma.emailTemplate.findMany({
      where: {
        key: {
          in: mailTemplateCatalog.map((item) => item.key),
        },
      },
      select: {
        id: true,
        key: true,
        isActive: true,
      },
    });
    const templatesByKey = new Map(templates.map((template) => [template.key, template]));
    const sampleResetPasswordUrl = `${this.getAdminWebOrigin()}/auth/reset-password?token=sample`;

    return mailTemplateCatalog.map((definition) => {
      const template = templatesByKey.get(definition.key);
      const variables = definition.variables.map((variable) =>
        variable.key === 'resetPasswordUrl' ? { ...variable, sampleValue: sampleResetPasswordUrl } : variable,
      );
      const samplePayload = {
        ...definition.samplePayload,
        ...(typeof definition.samplePayload.resetPasswordUrl === 'string' && {
          resetPasswordUrl: sampleResetPasswordUrl,
        }),
      };

      return {
        ...definition,
        variables,
        samplePayload,
        templateId: template?.id ?? null,
        isConfigured: Boolean(template),
        isActive: template?.isActive ?? false,
      };
    });
  }

  async getMailTemplateById(id: string): Promise<MailTemplateOutDto> {
    return this.toMailTemplateOut(await this.findExistingMailTemplateById(id));
  }

  async updateMailTemplate(id: string, dto: UpdateMailTemplateDto, userId: string): Promise<MailTemplateOutDto> {
    const existingTemplate = await this.findExistingMailTemplateById(id);
    const nextSubject = dto.subject ?? existingTemplate.subject;
    const nextHtmlBody = this.normalizeLegacyEmailVariableMarkup(dto.htmlBody ?? existingTemplate.htmlBody);
    const nextVariables = this.parseVariables(existingTemplate.variables);
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
        ...(dto.htmlBody !== undefined && { htmlBody: nextHtmlBody }),
        ...(this.hasOwn(dto, 'description') && { description: dto.description ?? null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedBy: userId,
      },
      include: this.mailTemplateInclude(),
    });

    return this.toMailTemplateOut(updatedTemplate);
  }

  async previewMailTemplate(id: string, dto: PreviewMailTemplateDto): Promise<RenderedMailTemplateOutDto> {
    const template = await this.findExistingMailTemplateById(id);
    const renderableTemplate = await this.resolveTemplateDraft(template, dto);

    return this.renderTemplate(renderableTemplate, dto.payload);
  }

  async sendTestMailTemplate(id: string, dto: SendTestMailTemplateDto): Promise<SendTestMailTemplateOutDto> {
    const template = await this.findExistingMailTemplateById(id);
    const renderableTemplate = await this.resolveTemplateDraft(template, dto);
    const rendered = this.renderTemplate(renderableTemplate, dto.payload);
    const { jobId } = await this.enqueueRenderedEmail({
      templateId: template.id,
      toEmail: dto.toEmail,
      subject: rendered.subject,
      htmlBody: rendered.htmlBody,
      payload: dto.payload,
    });

    return {
      accepted: true,
      jobId,
    };
  }

  async sendTemplateEmail(params: { key: string; toEmail: string; payload: Record<string, unknown>; fallback: MailTemplateFallback }): Promise<void> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: {
        key: params.key,
      },
      include: this.mailTemplateInclude(),
    });
    const rendered = template?.isActive ? this.renderTemplate(template, params.payload) : params.fallback;

    await this.enqueueRenderedEmail({
      templateId: template?.id ?? null,
      toEmail: params.toEmail,
      subject: rendered.subject,
      htmlBody: rendered.htmlBody,
      payload: params.payload,
    });
  }

  private async resolveTemplateDraft(
    template: ExistingMailTemplateEntity,
    draft: { subject?: string; htmlBody?: string; layoutId?: string | null },
  ): Promise<ExistingMailTemplateEntity> {
    const layout = this.hasOwn(draft, 'layoutId')
      ? draft.layoutId
        ? await this.findExistingEmailLayoutById(draft.layoutId)
        : null
      : template.layout;
    const renderableTemplate = {
      ...template,
      subject: draft.subject ?? template.subject,
      htmlBody: this.normalizeLegacyEmailVariableMarkup(draft.htmlBody ?? template.htmlBody),
      layout,
    };

    this.assertTemplateVariablesValid({
      subject: renderableTemplate.subject,
      htmlBody: renderableTemplate.htmlBody,
      layoutHtml: renderableTemplate.layout?.htmlLayout,
      variables: this.parseVariables(renderableTemplate.variables),
    });

    return renderableTemplate;
  }

  private renderTemplate(template: ExistingMailTemplateEntity, payload: Record<string, unknown>): RenderedMailTemplateOutDto {
    const variables = this.parseVariables(template.variables);
    this.assertPayloadHasVariables(template, variables, payload);
    const htmlBody = this.renderString(this.normalizeLegacyEmailVariableMarkup(template.htmlBody), payload);

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

  private assertLayoutValid(htmlLayout: string): void {
    if (!this.extractPlaceholders(htmlLayout).includes('content')) {
      throw new BadRequestException({
        code: 'EMAIL_LAYOUT_CONTENT_MISSING',
        message: 'Layout email phai co placeholder {{content}}',
      });
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
    return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, variable: string) => this.escapeHtml(this.stringifyPayloadValue(payload[variable])));
  }

  private renderLayoutString(layout: string, renderedContent: string, payload: Record<string, unknown>): string {
    return layout.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, variable: string) => {
      if (variable === 'content') {
        return renderedContent;
      }

      return this.escapeHtml(this.stringifyPayloadValue(payload[variable]));
    });
  }

  private extractPlaceholders(value: string): string[] {
    return [...value.matchAll(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g)].map((match) => match[1]);
  }

  private stringifyPayloadValue(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value.toString();

    return JSON.stringify(value) ?? '';
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

  private async enqueueRenderedEmail(input: {
    templateId: string | null;
    toEmail: string;
    subject: string;
    htmlBody: string;
    payload: Record<string, unknown>;
  }): Promise<{ jobId: string }> {
    return this.emailQueue.enqueue(
      {
        to: input.toEmail,
        subject: input.subject,
        html: input.htmlBody,
      },
      {},
    );
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
      include: {
        _count: {
          select: { templates: true },
        },
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
      htmlBody: this.normalizeLegacyEmailVariableMarkup(template.htmlBody),
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

  private toMailLayoutOut(layout: MailLayoutRecord): MailLayoutOutDto {
    return {
      id: layout.id,
      key: layout.key,
      name: layout.name,
      htmlLayout: layout.htmlLayout,
      isActive: layout.isActive,
      usedByCount: layout._count?.templates ?? 0,
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

  private getAdminWebOrigin(): string {
    return (this.configService.get<string>('ADMIN_WEB_ORIGIN', 'http://localhost:3000') ?? 'http://localhost:3000').replace(/\/+$/, '');
  }

  private normalizeLegacyEmailVariableMarkup(html: string): string {
    let normalized = html.replace(legacyVariableAttributePattern, '$1{{$2}}');

    normalized = normalized.replace(legacyTokenAnchorEndPattern, '$1>$2</a>');
    normalized = normalized.replace(legacyTokenAnchorClassPattern, (_match, prefix: string, quote: string, classValue: string) => {
      const classes = classValue.split(/\s+/).filter((className) => className && className !== 'email-variable-token');

      return classes.length ? `${prefix} class=${quote}${classes.join(' ')}${quote}` : prefix;
    });
    normalized = normalized.replace(emptyVariableSpanPattern, '');

    return normalized;
  }
}
