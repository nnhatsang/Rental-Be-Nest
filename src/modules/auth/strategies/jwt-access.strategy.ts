import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt';
import { Request } from 'express';
import { AUTH_ACCESS_COOKIE } from '../auth.constants';
import { AuthService } from '../auth.service';
import { JwtAccessPayload } from '../types/auth-user.type';
import { getCookieValue } from '../utils/cookie.util';
import { UNAUTHORIZED } from '@/libs/constants/error.constants';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([(request: Request) => getCookieValue(request, AUTH_ACCESS_COOKIE) ?? null]),
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    };

    super(options);
  }

  async validate(payload: JwtAccessPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    return this.authService.validateAccessUser(payload.sub);
  }
}
