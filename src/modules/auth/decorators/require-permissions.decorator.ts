import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '@/libs/constants/rbac.constant';
import { REQUIRED_PERMISSIONS_KEY } from '../auth.constants';

export const RequirePermissions = (...permissions: PermissionCode[]) => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
