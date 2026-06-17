export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  roles: string[];
  permissions: string[];
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  type: 'refresh';
}

export type RefreshRequestUser = JwtRefreshPayload;

export interface AuthCookiePayload {
  accessToken: string;
  refreshToken: string;
  accessMaxAge: number;
  refreshMaxAge: number;
}

export interface LoginResult {
  user: AuthUser;
  cookies: AuthCookiePayload;
}

export interface RefreshResult {
  user: AuthUser;
  cookies: AuthCookiePayload;
}
