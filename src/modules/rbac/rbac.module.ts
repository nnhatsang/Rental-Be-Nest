import { Module } from '@nestjs/common';
import { RbacPermissionService } from './rbac-permission.service';

@Module({
  providers: [RbacPermissionService],
  exports: [RbacPermissionService],
})
export class RbacModule {}

