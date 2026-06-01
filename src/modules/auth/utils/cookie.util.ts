import { CookieOptions, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AUTH_ACCESS_COOKIE, AUTH_CSRF_COOKIE, AUTH_REFRESH_COOKIE } from '../auth.constants';

export function getCookieValue(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return undefined;
  }

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .map((cookie) => {
      const separatorIndex = cookie.indexOf('=');
      return separatorIndex === -1
        ? [cookie, '']
        : [cookie.slice(0, separatorIndex), decodeURIComponent(cookie.slice(separatorIndex + 1))];
    })
    .find(([key]) => key === name)?.[1];
}

export function getAuthCookieOptions(configService: ConfigService, maxAge: number, httpOnly: boolean): CookieOptions {
  const sameSite = configService.get<'lax' | 'strict' | 'none'>('AUTH_COOKIE_SAME_SITE', 'lax');
  const secure = configService.get<boolean>('AUTH_COOKIE_SECURE', false);

  return {
    httpOnly,
    sameSite,
    secure,
    path: '/',
    maxAge,
  };
}

export function setAuthCookies(
  response: Response,
  configService: ConfigService,
  tokens: {
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
    accessMaxAge: number;
    refreshMaxAge: number;
  },
) {
  response.cookie(
    AUTH_ACCESS_COOKIE,
    tokens.accessToken,
    getAuthCookieOptions(configService, tokens.accessMaxAge, true),
  );
  response.cookie(
    AUTH_REFRESH_COOKIE,
    tokens.refreshToken,
    getAuthCookieOptions(configService, tokens.refreshMaxAge, true),
  );
  response.cookie(AUTH_CSRF_COOKIE, tokens.csrfToken, getAuthCookieOptions(configService, tokens.refreshMaxAge, false));
}

export function clearAuthCookies(response: Response, configService: ConfigService) {
  const options = getAuthCookieOptions(configService, 0, true);
  const csrfOptions = getAuthCookieOptions(configService, 0, false);

  response.clearCookie(AUTH_ACCESS_COOKIE, options);
  response.clearCookie(AUTH_REFRESH_COOKIE, options);
  response.clearCookie(AUTH_CSRF_COOKIE, csrfOptions);
}
