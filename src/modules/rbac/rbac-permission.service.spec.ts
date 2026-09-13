import { RbacPermissionService } from './rbac-permission.service';
import { REDIS_EXPIRE } from '@/libs/redis/constant/prefix.constant';
import { REDIS_KEYS } from '@/libs/redis/redis-key.constant';

describe('RbacPermissionService', () => {
  const prisma = {
    userRole: {
      findMany: jest.fn(),
    },
  };
  const redis = {
    get: jest.fn(),
    setJson: jest.fn(),
    deleteBestEffort: jest.fn(),
  };

  let service: RbacPermissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    redis.setJson.mockResolvedValue(undefined);
    redis.deleteBestEffort.mockResolvedValue(undefined);
    service = new RbacPermissionService(prisma as never, redis as never);
  });

  it('returns valid cached authorization without querying PostgreSQL', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        userId: 'user-1',
        roles: ['STAFF'],
        permissions: ['users.read'],
        cachedAt: '2026-09-13T00:00:00.000Z',
      }),
    );

    await expect(service.getUserAuthorization('user-1')).resolves.toEqual({
      userId: 'user-1',
      roles: ['STAFF'],
      permissions: ['users.read'],
      cachedAt: '2026-09-13T00:00:00.000Z',
    });

    expect(prisma.userRole.findMany).not.toHaveBeenCalled();
    expect(redis.setJson).not.toHaveBeenCalled();
  });

  it('loads, deduplicates, sorts, and caches authorization on a miss', async () => {
    redis.get.mockResolvedValue(null);
    prisma.userRole.findMany.mockResolvedValue([
      {
        role: {
          code: 'STAFF',
          permissions: [{ permission: { code: 'users.update' } }, { permission: { code: 'orders.read' } }],
        },
      },
      {
        role: {
          code: 'STAFF',
          permissions: [{ permission: { code: 'orders.read' } }],
        },
      },
    ]);

    const result = await service.getUserAuthorization('user-1');

    expect(result).toEqual({
      userId: 'user-1',
      roles: ['STAFF'],
      permissions: ['orders.read', 'users.update'],
      cachedAt: expect.any(String),
    });
    expect(prisma.userRole.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: {
        role: {
          select: {
            code: true,
            permissions: {
              select: {
                permission: {
                  select: { code: true },
                },
              },
            },
          },
        },
      },
    });
    expect(redis.setJson).toHaveBeenCalledWith(
      REDIS_KEYS.rbac.userPermissions('user-1'),
      expect.objectContaining({
        userId: 'user-1',
        roles: ['STAFF'],
        permissions: ['orders.read', 'users.update'],
      }),
      REDIS_EXPIRE.RBAC_USER_PERMISSION_CACHE,
    );
  });

  it('deletes malformed cache and falls back to PostgreSQL', async () => {
    redis.get.mockResolvedValue('{"userId":"another-user","roles":[],"permissions":[],"cachedAt":"now"}');
    prisma.userRole.findMany.mockResolvedValue([]);

    const result = await service.getUserAuthorization('user-1');

    expect(result.roles).toEqual([]);
    expect(result.permissions).toEqual([]);
    expect(redis.deleteBestEffort).toHaveBeenCalledWith(REDIS_KEYS.rbac.userPermissions('user-1'));
    expect(prisma.userRole.findMany).toHaveBeenCalledTimes(1);
  });

  it('falls back to PostgreSQL when Redis read fails', async () => {
    redis.get.mockRejectedValue(new Error('redis unavailable'));
    prisma.userRole.findMany.mockResolvedValue([]);

    await expect(service.getUserAuthorization('user-1')).resolves.toEqual({
      userId: 'user-1',
      roles: [],
      permissions: [],
      cachedAt: expect.any(String),
    });
    expect(prisma.userRole.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns PostgreSQL data when Redis write fails', async () => {
    redis.get.mockResolvedValue(null);
    redis.setJson.mockRejectedValue(new Error('redis unavailable'));
    prisma.userRole.findMany.mockResolvedValue([]);

    await expect(service.getUserAuthorization('user-1')).resolves.toEqual({
      userId: 'user-1',
      roles: [],
      permissions: [],
      cachedAt: expect.any(String),
    });
  });

  it('invalidates unique user permission keys', async () => {
    await service.invalidateUsersPermissions(['user-1', 'user-1', 'user-2']);

    expect(redis.deleteBestEffort).toHaveBeenCalledWith(
      REDIS_KEYS.rbac.userPermissions('user-1'),
      REDIS_KEYS.rbac.userPermissions('user-2'),
    );
  });
});

