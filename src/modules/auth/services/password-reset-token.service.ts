import { createHmac, randomBytes } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import type { Redis } from 'ioredis';
import { PASSWORD_RESET_TOKEN_INVALID } from '@/libs/constants/error.constants';

type PasswordResetPayload = {
  userId: string;
};

export type VerifiedPasswordResetToken = PasswordResetPayload & {
  tokenHash: string;
};

@Injectable()
export class PasswordResetTokenService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async createForUser(userId: string): Promise<string> {
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);
    const ttlSeconds = this.getExpiresInSeconds();
    const redis = this.getRedisClient();
    const tokenKey = this.getTokenKey(tokenHash);
    const userKey = this.getUserKey(userId);
    const existingTokenHash = await redis.get(userKey);
    const pipeline = redis.multi();

    if (existingTokenHash) {
      pipeline.del(this.getTokenKey(existingTokenHash));
    }

    pipeline.set(tokenKey, JSON.stringify({ userId } satisfies PasswordResetPayload), 'EX', ttlSeconds);
    pipeline.set(userKey, tokenHash, 'EX', ttlSeconds);
    await pipeline.exec();

    return rawToken;
  }

  async verify(token: string): Promise<VerifiedPasswordResetToken> {
    const tokenHash = this.hashToken(token);
    const redis = this.getRedisClient();
    const tokenKey = this.getTokenKey(tokenHash);
    const rawPayload = await redis.get(tokenKey);

    if (!rawPayload) {
      throw new BadRequestException(PASSWORD_RESET_TOKEN_INVALID);
    }

    const payload = this.parsePayload(rawPayload);
    const activeTokenHash = await redis.get(this.getUserKey(payload.userId));

    if (activeTokenHash !== tokenHash) {
      await redis.del(tokenKey);
      throw new BadRequestException(PASSWORD_RESET_TOKEN_INVALID);
    }

    return { ...payload, tokenHash };
  }

  async consume(token: VerifiedPasswordResetToken): Promise<void> {
    const redis = this.getRedisClient();
    await redis.del(this.getTokenKey(token.tokenHash), this.getUserKey(token.userId));
  }

  private getRedisClient(): Redis {
    return this.redisService.getOrThrow();
  }

  private getExpiresInSeconds(): number {
    return this.configService.get<number>('RESET_PASSWORD_EXPIRES_IN_SECONDS', 1800);
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHmac('sha256', this.configService.getOrThrow<string>('RESET_PASSWORD_SECRET')).update(token).digest('hex');
  }

  private getTokenKey(tokenHash: string): string {
    return `auth:password-reset:token:${tokenHash}`;
  }

  private getUserKey(userId: string): string {
    return `auth:password-reset:user:${userId}`;
  }

  private parsePayload(rawPayload: string): PasswordResetPayload {
    try {
      const payload = JSON.parse(rawPayload) as Partial<PasswordResetPayload>;

      if (!payload.userId) {
        throw new Error('Missing userId');
      }

      return { userId: payload.userId };
    } catch {
      throw new BadRequestException(PASSWORD_RESET_TOKEN_INVALID);
    }
  }
}
