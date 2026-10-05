import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiRes } from '@/libs/types/custom-response.type';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { SUCCESS } from '@/libs/constants/response.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { CreateUploadDto } from './dto/create-upload.dto';
import { FileStorageService } from './file-storage.service';
import { FileUploadPoliciesOutDto, UploadCompleteOutDto, UploadOutDto } from './dto/file-storage-out.dto';

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

  @Post(':id/complete')
  @RequirePermissions(PermissionCode.FilesUpload)
  @ApiOperation({ summary: 'Complete an upload after all files are uploaded to R2' })
  @ApiOkResponse({ type: UploadCompleteOutDto })
  async completeUpload(@Param('id', IdValidatePipe) id: string, @CurrentUser() actor: AuthUser) {
    return new ApiRes(await this.fileStorageService.completeUploadBatch(id, actor), SUCCESS);
  }

  @Delete(':id')
  @RequirePermissions(PermissionCode.FilesUpload)
  @ApiOperation({ summary: 'Cancel an upload and clean up its pending objects' })
  @ApiOkResponse({ type: UploadCompleteOutDto })
  async cancelUpload(@Param('id', IdValidatePipe) id: string, @CurrentUser() actor: AuthUser) {
    return new ApiRes(await this.fileStorageService.cancelUpload(id, actor), SUCCESS);
  }
}
