import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { Request } from 'express';
import { JwtRefreshPayload } from '../types/auth-user.type';
import { AUTH_REFRESH_COOKIE } from '../auth.constants';
import { getCookieValue } from '../utils/cookie.util';
import { UNAUTHORIZED } from '@/libs/constants/error.constants';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => getCookieValue(request, AUTH_REFRESH_COOKIE) ?? null,
      ]),
      passReqToCallback: true,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    };

    super(options);
  }

  validate(request: Request, payload: JwtRefreshPayload) {
    if (payload.type !== 'refresh' || !getCookieValue(request, AUTH_REFRESH_COOKIE)) {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    return payload;
  }
}
