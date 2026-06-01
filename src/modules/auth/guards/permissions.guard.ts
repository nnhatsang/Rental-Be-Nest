import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../auth.constants';
import { AuthUser } from '../types/auth-user.type';
import { FORBIDDEN } from '@/libs/constants/error.constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const userPermissions = new Set(request.user?.permissions ?? []);
    const allowed = requiredPermissions.every((permission) => userPermissions.has(permission));

    if (!allowed) {
      throw new ForbiddenException(FORBIDDEN);
    }

    return true;
  }
}
