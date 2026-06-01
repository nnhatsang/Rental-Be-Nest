import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { AUTH_CSRF_COOKIE, CSRF_HEADER, PUBLIC_ROUTE_KEY } from '../auth.constants';
import { AuthUser } from '../types/auth-user.type';
import { getCookieValue } from '../utils/cookie.util';
import { PrismaService } from '@modules/database/prisma.service';
import { INVALID_AUTH_SESSION, INVALID_CSRF_TOKEN } from '@/libs/constants/error.constants';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();

    if (isPublic || !UNSAFE_METHODS.has(request.method)) {
      return true;
    }

    const user = request.user;
    const csrfHeader = request.headers[CSRF_HEADER];
    const csrfHeaderValue = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
    const csrfCookieValue = getCookieValue(request, AUTH_CSRF_COOKIE);

    if (!user?.sessionId || !csrfHeaderValue || !csrfCookieValue || csrfHeaderValue !== csrfCookieValue) {
      throw new ForbiddenException(INVALID_CSRF_TOKEN);
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: user.sessionId },
      select: { csrfTokenHash: true, isRevoked: true, expiresAt: true },
    });

    if (!session || session.isRevoked || session.expiresAt <= new Date()) {
      throw new ForbiddenException(INVALID_AUTH_SESSION);
    }

    const csrfValid = await bcrypt.compare(csrfHeaderValue, session.csrfTokenHash);

    if (!csrfValid) {
      throw new ForbiddenException(INVALID_CSRF_TOKEN);
    }

    return true;
  }
}
