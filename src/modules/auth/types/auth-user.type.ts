export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
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
