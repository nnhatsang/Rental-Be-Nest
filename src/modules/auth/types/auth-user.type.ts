export interface AuthUser {
  id: string;
  sessionId: string;
  email: string;
  fullName: string;
  phone: string | null;
  roles: string[];
  permissions: string[];
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  sid: string;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  sid: string;
  type: 'refresh';
}

export type RefreshRequestUser = JwtRefreshPayload & {
  refreshToken: string;
};

export interface AuthSession {
  sessionId: string;
  userId: string;
  refreshTokenHash: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  fcmToken?: string;
}

export interface AuthCookiePayload {
  sessionId: string;
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
