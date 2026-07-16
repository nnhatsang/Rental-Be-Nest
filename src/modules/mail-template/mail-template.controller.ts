import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { CreateMailLayoutDto } from './dto/create-mail-layout.dto';
import { GetAllMailTemplatesDto } from './dto/get-all-mail-templates.dto';
import {
  MailLayoutResponseDto,
  MailLayoutsPaginatedResponseDto,
  MailTemplateResponseDto,
  MailTemplatesPaginatedResponseDto,
  RenderedMailTemplateResponseDto,
  SendTestMailTemplateResponseDto,
} from './dto/mail-template-response.dto';
import { PreviewMailTemplateDto } from './dto/preview-mail-template.dto';
import { SendTestMailTemplateDto } from './dto/send-test-mail-template.dto';
import { UpdateMailLayoutDto } from './dto/update-mail-layout.dto';
import { UpdateMailTemplateDto } from './dto/update-mail-template.dto';
import { MailTemplateService } from './mail-template.service';

@ApiTags('mail-templates')
@Controller('mail-templates')
export class MailTemplateController {
  constructor(private readonly mailTemplateService: MailTemplateService) {}

  @Get('layouts')
  @RequirePermissions(PermissionCode.EmailTemplatesRead)
  @ApiOperation({ summary: 'Lay danh sach layout email' })
  @ApiOkResponse({ type: MailLayoutsPaginatedResponseDto })
  async getAllMailLayouts(@Query() query: GetAllMailTemplatesDto) {
    return new ApiPaginatedResponseDto(await this.mailTemplateService.getAllMailLayouts(query), 'Lay danh sach layout email thanh cong');
  }

  @Get('layouts/:id')
  @RequirePermissions(PermissionCode.EmailTemplatesRead)
  @ApiOperation({ summary: 'Lay chi tiet layout email' })
  @ApiOkResponse({ type: MailLayoutResponseDto })
  async getMailLayoutById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.mailTemplateService.getMailLayoutById(id), 'Lay layout email thanh cong');
  }

  @Post('layouts')
  @RequirePermissions(PermissionCode.EmailTemplatesUpdate)
  @ApiOperation({ summary: 'Tao layout email' })
  @ApiOkResponse({ type: MailLayoutResponseDto })
  async createMailLayout(@CurrentUser() user: AuthUser, @Body() dto: CreateMailLayoutDto) {
    return new ApiRes(await this.mailTemplateService.createMailLayout(dto, user.id), 'Tao layout email thanh cong');
  }

  @Patch('layouts/:id')
  @RequirePermissions(PermissionCode.EmailTemplatesUpdate)
  @ApiOperation({ summary: 'Cap nhat layout email' })
  @ApiOkResponse({ type: MailLayoutResponseDto })
  async updateMailLayout(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateMailLayoutDto) {
    return new ApiRes(await this.mailTemplateService.updateMailLayout(id, dto, user.id), 'Cap nhat layout email thanh cong');
  }

  @Get()
  @RequirePermissions(PermissionCode.EmailTemplatesRead)
  @ApiOperation({ summary: 'Lay danh sach mau email' })
  @ApiOkResponse({ type: MailTemplatesPaginatedResponseDto })
  async getAllMailTemplates(@Query() query: GetAllMailTemplatesDto) {
    return new ApiPaginatedResponseDto(await this.mailTemplateService.getAllMailTemplates(query), 'Lay danh sach mau email thanh cong');
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.EmailTemplatesRead)
  @ApiOperation({ summary: 'Lay chi tiet mau email' })
  @ApiOkResponse({ type: MailTemplateResponseDto })
  async getMailTemplateById(@Param('id', IdValidatePipe) id: string) {
    return new ApiRes(await this.mailTemplateService.getMailTemplateById(id), 'Lay mau email thanh cong');
  }

  @Patch(':id')
  @RequirePermissions(PermissionCode.EmailTemplatesUpdate)
  @ApiOperation({ summary: 'Cap nhat mau email' })
  @ApiOkResponse({ type: MailTemplateResponseDto })
  async updateMailTemplate(@CurrentUser() user: AuthUser, @Param('id', IdValidatePipe) id: string, @Body() dto: UpdateMailTemplateDto) {
    return new ApiRes(await this.mailTemplateService.updateMailTemplate(id, dto, user.id), 'Cap nhat mau email thanh cong');
  }

  @Post(':id/preview')
  @RequirePermissions(PermissionCode.EmailTemplatesPreview)
  @ApiOperation({ summary: 'Render preview mau email voi payload mau' })
  @ApiOkResponse({ type: RenderedMailTemplateResponseDto })
  async previewMailTemplate(@Param('id', IdValidatePipe) id: string, @Body() dto: PreviewMailTemplateDto) {
    return new ApiRes(await this.mailTemplateService.previewMailTemplate(id, dto), 'Render mau email thanh cong');
  }

  @Post(':id/send-test')
  @RequirePermissions(PermissionCode.EmailTemplatesSendTest)
  @ApiOperation({ summary: 'Gui thu mau email den mot dia chi' })
  @ApiOkResponse({ type: SendTestMailTemplateResponseDto })
  async sendTestMailTemplate(@Param('id', IdValidatePipe) id: string, @Body() dto: SendTestMailTemplateDto) {
    return new ApiRes(await this.mailTemplateService.sendTestMailTemplate(id, dto), 'Gui thu mau email hoan tat');
  }
}
