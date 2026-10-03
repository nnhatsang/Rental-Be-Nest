import { UnauthorizedException } from '@nestjs/common';
import { AuthAuditEvent } from '@generated/prisma/client';
import { REDIS_KEYS } from '@/libs/redis/redis-key.constant';
import { AuthService } from './auth.service';
import { AuthSession, AuthUser } from './types/auth-user.type';

describe('AuthService session management', () => {
  const redis = {
    del: jest.fn(),
    getJson: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
  };
  const audit = {
    record: jest.fn(),
  };

  let service: AuthService;

  const currentUser: AuthUser = {
    id: 'user-1',
    sessionId: 'sid-current',
    email: 'admin@example.com',
    fullName: 'Admin',
    phone: null,
    roles: ['ADMIN'],
    permissions: [],
  };

  const session = (sessionId: string, userId = 'user-1', lastUsedAt = '2026-10-04T00:00:00.000Z'): AuthSession => ({
    sessionId,
    userId,
    refreshTokenHash: 'hash',
    createdAt: '2026-10-03T00:00:00.000Z',
    lastUsedAt,
    expiresAt: '2026-10-11T00:00:00.000Z',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    deviceId: 'test-device',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    redis.del.mockResolvedValue(undefined);
    redis.srem.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);

    service = new AuthService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      redis as never,
      {} as never,
      audit as never,
    );
  });

  it('lists active sessions, puts the current session first, and cleans stale ids', async () => {
    const sessions = new Map([
      [REDIS_KEYS.auth.session('sid-current'), session('sid-current', 'user-1', '2026-10-04T02:00:00.000Z')],
      [REDIS_KEYS.auth.session('sid-other'), session('sid-other', 'user-1', '2026-10-04T01:00:00.000Z')],
    ]);
    redis.smembers.mockResolvedValue(['sid-other', 'sid-current', 'sid-stale']);
    redis.getJson.mockImplementation((key: string) => sessions.get(key) ?? null);

    await expect(service.getActiveSessions(currentUser)).resolves.toMatchObject([
      { sessionId: 'sid-current', isCurrent: true },
      { sessionId: 'sid-other', isCurrent: false },
    ]);

    expect(redis.srem).toHaveBeenCalledWith(REDIS_KEYS.auth.userSessions('user-1'), 'sid-stale');
  });

  it('revokes only sessions owned by the current user', async () => {
    const sessions = new Map([
      [REDIS_KEYS.auth.session('sid-current'), session('sid-current')],
      [REDIS_KEYS.auth.session('sid-other'), session('sid-other')],
      [REDIS_KEYS.auth.session('sid-foreign'), session('sid-foreign', 'user-2')],
    ]);
    redis.smembers.mockResolvedValue(['sid-current', 'sid-other', 'sid-foreign']);
    redis.getJson.mockImplementation((key: string) => sessions.get(key) ?? null);

    await expect(service.revokeOtherSessions(currentUser)).resolves.toEqual({ success: true, revokedCount: 1 });

    expect(redis.del).toHaveBeenCalledWith(REDIS_KEYS.auth.session('sid-other'));
    expect(redis.del).not.toHaveBeenCalledWith(REDIS_KEYS.auth.session('sid-foreign'));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AuthAuditEvent.SESSIONS_REVOKED,
        userId: 'user-1',
        metadata: { revokedCount: 1 },
      }),
    );
  });

  it('rejects revoking a session owned by another user', async () => {
    redis.getJson.mockResolvedValue(session('sid-foreign', 'user-2'));

    await expect(service.revokeActiveSession(currentUser, 'sid-foreign')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redis.del).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('loads authorization before rotating the refresh session', async () => {
    const toAuthUser = jest.spyOn(service as any, 'toAuthUser').mockResolvedValue(currentUser);
    const rotateRefreshSession = jest.spyOn(service as any, 'rotateRefreshSession').mockResolvedValue({} as never);

    jest.spyOn(service as any, 'validateRefreshSession').mockResolvedValue(session('sid-current'));
    jest.spyOn(service as any, 'validateRefreshUser').mockResolvedValue({
      id: 'user-1',
      email: currentUser.email,
      fullName: currentUser.fullName,
      phone: currentUser.phone,
      activityStatus: 'ACTIVE',
      deletedAt: null,
    } as never);

    await service.refresh({ sub: 'user-1', sid: 'sid-current', type: 'refresh', refreshToken: 'refresh-token' });

    expect(toAuthUser.mock.invocationCallOrder[0]).toBeLessThan(rotateRefreshSession.mock.invocationCallOrder[0]);
  });
});
