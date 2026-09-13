import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@modules/database/prisma.service';
import { REDIS_EXPIRE } from '@/libs/redis/constant/prefix.constant';
import { REDIS_KEYS } from '@/libs/redis/redis-key.constant';
import { RedisService } from '@/libs/redis/redis.service';

export type UserAuthorization = {
  userId: string;
  roles: string[];
  permissions: string[];
  cachedAt: string;
};

@Injectable()
export class RbacPermissionService {
  private readonly logger = new Logger(RbacPermissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getUserAuthorization(userId: string): Promise<UserAuthorization> {
    const key = REDIS_KEYS.rbac.userPermissions(userId);
    const cachedAuthorization = await this.readCachedAuthorization(key, userId);

    if (cachedAuthorization) {
      return cachedAuthorization;
    }

    const authorization = await this.loadUserAuthorization(userId);

    try {
      await this.redis.setJson(key, authorization, REDIS_EXPIRE.RBAC_USER_PERMISSION_CACHE);
    } catch (error) {
      this.logger.warn(`RBAC permission cache write failed for user ${userId}: ${this.errorMessage(error)}`);
    }

    return authorization;
  }

  async invalidateUserPermissions(userId: string): Promise<void> {
    await this.invalidateUsersPermissions([userId]);
  }

  async invalidateUsersPermissions(userIds: string[]): Promise<void> {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueUserIds.length === 0) {
      return;
    }

    const keys = uniqueUserIds.map((userId) => REDIS_KEYS.rbac.userPermissions(userId));
    await this.redis.deleteBestEffort(...keys);
  }

  private async readCachedAuthorization(key: string, userId: string): Promise<UserAuthorization | null> {
    let rawValue: string | null;

    try {
      rawValue = await this.redis.get(key);
    } catch (error) {
      this.logger.warn(`RBAC permission cache read failed for user ${userId}: ${this.errorMessage(error)}`);
      return null;
    }

    if (rawValue === null) {
      return null;
    }

    const cachedAuthorization = this.parseCachedAuthorization(rawValue, userId);

    if (cachedAuthorization) {
      return cachedAuthorization;
    }

    await this.redis.deleteBestEffort(key);
    return null;
  }

  private async loadUserAuthorization(userId: string): Promise<UserAuthorization> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: {
            code: true,
            permissions: {
              select: {
                permission: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const roles = [...new Set(userRoles.map((userRole) => userRole.role.code))].sort();
    const permissions = [
      ...new Set(
        userRoles.flatMap((userRole) => userRole.role.permissions.map((rolePermission) => rolePermission.permission.code)),
      ),
    ].sort();

    return {
      userId,
      roles,
      permissions,
      cachedAt: new Date().toISOString(),
    };
  }

  private parseCachedAuthorization(rawValue: string, userId: string): UserAuthorization | null {
    try {
      const parsed = JSON.parse(rawValue) as Partial<UserAuthorization>;

      if (
        parsed.userId !== userId ||
        !Array.isArray(parsed.roles) ||
        !Array.isArray(parsed.permissions) ||
        !parsed.roles.every((role) => typeof role === 'string') ||
        !parsed.permissions.every((permission) => typeof permission === 'string') ||
        typeof parsed.cachedAt !== 'string'
      ) {
        throw new Error('Invalid RBAC authorization payload');
      }

      return {
        userId: parsed.userId,
        roles: [...new Set(parsed.roles)].sort(),
        permissions: [...new Set(parsed.permissions)].sort(),
        cachedAt: parsed.cachedAt,
      };
    } catch (error) {
      this.logger.warn(`Invalid RBAC permission cache for user ${userId}: ${this.errorMessage(error)}`);
      return null;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
