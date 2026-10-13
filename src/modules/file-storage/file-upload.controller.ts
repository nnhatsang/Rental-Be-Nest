import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PermissionCode } from '@/libs/constants/rbac.constant';
import { SUCCESS } from '@/libs/constants/response.constant';
import { ApiRes } from '@/libs/types/custom-response.type';

import { CreateUploadDto } from './dto/create-upload.dto';
import { FileUploadPoliciesOutDto, UploadOutDto } from './dto/file-storage-out.dto';
import { FileStorageService } from './file-storage.service';

@ApiTags('uploads')
@Controller('uploads')
export class FileUploadController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  @Get('policies')
  @RequirePermissions(PermissionCode.FilesUpload)
  @ApiOperation({ summary: 'Get upload limits and allowed MIME types' })
  @ApiOkResponse({ type: FileUploadPoliciesOutDto })
  getUploadPolicies() {
    return new ApiRes(this.fileStorageService.getUploadPolicies(), SUCCESS);
  }

  @Post()
  @RequirePermissions(PermissionCode.FilesUpload)
  @ApiOperation({ summary: 'Create a direct-to-R2 upload' })
  @ApiOkResponse({ type: UploadOutDto })
  async createUpload(@CurrentUser() actor: AuthUser, @Body() dto: CreateUploadDto) {
    return new ApiRes(await this.fileStorageService.createUpload(dto, actor), SUCCESS);
  }
}
