import { ApiProperty } from '@nestjs/swagger';
import { ApiPag, ApiRes } from '@/libs/types/custom-response.type';
import { MailLayoutOutDto } from './mail-layout-out.dto';
import { MailTemplateOutDto, RenderedMailTemplateOutDto, SendTestMailTemplateOutDto } from './mail-template-out.dto';

export class MailLayoutResponseDto extends ApiRes<MailLayoutOutDto> {
  @ApiProperty({ type: MailLayoutOutDto })
  declare data: MailLayoutOutDto;
}

export class MailLayoutsPaginatedResponseDto extends ApiRes<ApiPag<MailLayoutOutDto>> {
  @ApiProperty({ type: ApiPag<MailLayoutOutDto> })
  declare data: ApiPag<MailLayoutOutDto>;
}

export class MailTemplateResponseDto extends ApiRes<MailTemplateOutDto> {
  @ApiProperty({ type: MailTemplateOutDto })
  declare data: MailTemplateOutDto;
}

export class MailTemplatesPaginatedResponseDto extends ApiRes<ApiPag<MailTemplateOutDto>> {
  @ApiProperty({ type: ApiPag<MailTemplateOutDto> })
  declare data: ApiPag<MailTemplateOutDto>;
}

export class RenderedMailTemplateResponseDto extends ApiRes<RenderedMailTemplateOutDto> {
  @ApiProperty({ type: RenderedMailTemplateOutDto })
  declare data: RenderedMailTemplateOutDto;
}

export class SendTestMailTemplateResponseDto extends ApiRes<SendTestMailTemplateOutDto> {
  @ApiProperty({ type: SendTestMailTemplateOutDto })
  declare data: SendTestMailTemplateOutDto;
}
