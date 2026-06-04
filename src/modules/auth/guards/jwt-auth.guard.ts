import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PUBLIC_ROUTE_KEY } from '../auth.constants';
import { UNAUTHORIZED } from '@/libs/constants/error.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-access') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  // handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown): TUser {
  //   if (err) {
  //     throw err;
  //   }

  //   if (!user) {
  //     throw new UnauthorizedException(UNAUTHORIZED)
  //   }

  //   return user;
  // }
}
