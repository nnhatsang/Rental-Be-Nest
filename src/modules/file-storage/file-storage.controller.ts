import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiRes } from '@/libs/types/custom-response.type';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { SUCCESS } from '@/libs/constants/response.constant';
import { IdValidatePipe } from '@/libs/pipe/id-validate.pipe';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@modules/auth/decorators/require-permissions.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { FileDownloadUrlOutDto, FileObjectOutDto } from './dto/file-storage-out.dto';
import { FileStorageService } from './file-storage.service';

@ApiTags('files')
@Controller('files')
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  @Post(':id/complete')
  @RequirePermissions(PermissionCode.FilesUpload)
  @ApiOperation({ summary: 'Xác minh object trên R2 và đánh dấu tệp READY' })
  @ApiOkResponse({ type: FileObjectOutDto })
  async completeUpload(@Param('id', IdValidatePipe) id: string, @CurrentUser() actor: AuthUser) {
    return new ApiRes(await this.fileStorageService.completeUpload(id, actor), SUCCESS);
  }

  @Get(':id/download-url')
  @RequirePermissions(PermissionCode.FilesRead)
  @ApiOperation({ summary: 'Tạo signed download URL cho tệp đã hoàn tất' })
  @ApiOkResponse({ type: FileDownloadUrlOutDto })
  async createDownloadUrl(@Param('id', IdValidatePipe) id: string, @CurrentUser() actor: AuthUser) {
    return new ApiRes(await this.fileStorageService.createDownloadUrl(id, actor), SUCCESS);
  }

  @Delete(':id')
  @RequirePermissions(PermissionCode.FilesDelete)
  @ApiOperation({ summary: 'Xóa object R2 và soft-delete metadata' })
  @ApiOkResponse({ type: FileObjectOutDto })
  async deleteFile(@Param('id', IdValidatePipe) id: string, @CurrentUser() actor: AuthUser) {
    return new ApiRes(await this.fileStorageService.deleteFile(id, actor), SUCCESS);
  }
}
