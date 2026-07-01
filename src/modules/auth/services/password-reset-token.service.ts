import { createHmac, randomBytes } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PASSWORD_RESET_TOKEN_INVALID } from '@/libs/constants/error.constants';
import { REDIS_KEYS } from '@/libs/redis/redis-key.constant';
import { RedisService } from '@/libs/redis/redis.service';

type PasswordResetPayload = {
  userId: string;
};

export type VerifiedPasswordResetToken = PasswordResetPayload & {
  tokenHash: string;
};

@Injectable()
export class PasswordResetTokenService {
  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Tạo token reset password cho user.
   * Nếu user đã có token cũ → tự động xóa trước khi tạo mới.
   * Trả về raw token (gửi qua email), không lưu raw token vào Redis.
   */
  async createForUser(userId: string): Promise<string> {
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);
    const ttlSeconds = this.getExpiresInSeconds();

    const tokenKey = REDIS_KEYS.auth.passwordResetToken(tokenHash);
    const userKey = REDIS_KEYS.auth.passwordResetUser(userId);

    // Xóa token cũ nếu tồn tại để tránh rác trong Redis
    const existingTokenHash = await this.redis.get(userKey);
    const pipeline = this.redis.pipeline();

    if (existingTokenHash) {
      pipeline.del(REDIS_KEYS.auth.passwordResetToken(existingTokenHash));
    }

    pipeline.set(tokenKey, JSON.stringify({ userId } satisfies PasswordResetPayload), 'EX', ttlSeconds);
    pipeline.set(userKey, tokenHash, 'EX', ttlSeconds);
    await pipeline.exec();

    return rawToken;
  }

  /**
   * Xác minh token còn hiệu lực và khớp với userId.
   * Trả về payload + tokenHash để dùng trong bước consume.
   */
  async verify(token: string): Promise<VerifiedPasswordResetToken> {
    const tokenHash = this.hashToken(token);
    const tokenKey = REDIS_KEYS.auth.passwordResetToken(tokenHash);
    const rawPayload = await this.redis.get(tokenKey);

    if (!rawPayload) {
      throw new BadRequestException(PASSWORD_RESET_TOKEN_INVALID);
    }

    const payload = this.parsePayload(rawPayload);
    const activeTokenHash = await this.redis.get(REDIS_KEYS.auth.passwordResetUser(payload.userId));

    // Token đã bị thay thế bởi token mới hơn của cùng user
    if (activeTokenHash !== tokenHash) {
      await this.redis.del(tokenKey);
      throw new BadRequestException(PASSWORD_RESET_TOKEN_INVALID);
    }

    return { ...payload, tokenHash };
  }

  /**
   * Xóa token sau khi đã dùng để đặt lại mật khẩu thành công.
   */
  async consume(token: VerifiedPasswordResetToken): Promise<void> {
    await this.redis.del(
      REDIS_KEYS.auth.passwordResetToken(token.tokenHash),
      REDIS_KEYS.auth.passwordResetUser(token.userId),
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private getExpiresInSeconds(): number {
    return this.configService.get<number>('RESET_PASSWORD_EXPIRES_IN_SECONDS', 1800);
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHmac('sha256', this.configService.getOrThrow<string>('RESET_PASSWORD_SECRET'))
      .update(token)
      .digest('hex');
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
