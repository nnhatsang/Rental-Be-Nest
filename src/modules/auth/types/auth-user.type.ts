export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  sessionId: string;
  roles: string[];
  permissions: string[];
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  sessionId: string;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
  type: 'refresh';
}

export interface RefreshRequestUser extends JwtRefreshPayload {
  refreshToken: string;
}

export interface AuthCookiePayload {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  accessMaxAge: number;
  refreshMaxAge: number;
}

export interface LoginResult {
  user: AuthUser;
  cookies: AuthCookiePayload;
}

export interface RefreshResult {
  cookies: AuthCookiePayload;
}
