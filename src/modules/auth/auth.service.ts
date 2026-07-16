import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@modules/database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  AuthCookiePayload,
  AuthSession,
  AuthUser,
  JwtAccessPayload,
  JwtRefreshPayload,
  LoginResult,
  RefreshRequestUser,
  RefreshResult,
} from './types/auth-user.type';
import { parseDurationMs } from './utils/duration.util';
import {
  EUserActivityStatus,
  INVALID_SESSION,
  OLD_PASSWORD_NOT_VALID,
  PASSWORD_CONFIRM_NOT_MATCH,
  PASSWORD_NOT_MATCH,
  PASSWORD_RESET_TOKEN_INVALID,
  USER_ACTIVITY_ERRORS,
  USER_EMAIL_EXISTED,
  USER_NOT_FOUND,
} from '@/libs/constants/error.constants';
import { buildUserSearchText } from '@/libs/utils/search-text.util';
import { User } from '@generated/prisma/browser';
import { MailService } from '@modules/mail/mail.service';
import { PasswordResetTokenService } from './services/password-reset-token.service';
import { RedisService } from '@/libs/redis/redis.service';
import { REDIS_KEYS } from '@/libs/redis/redis-key.constant';
import { REDIS_EXPIRE } from '@/libs/redis/constant/prefix.constant';
import { MailTemplateKey, MailTemplateService } from '@/modules/mail-template/mail-template.service';

type UserWithAuth = User & {
  roles: {
    role: {
      code: string;
      permissions: {
        permission: {
          code: string;
        };
      }[];
    };
  }[];
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly mailTemplateService: MailTemplateService,
    private readonly passwordResetTokenService: PasswordResetTokenService,
    private readonly redis: RedisService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.validateLoginCredentials(dto.email, dto.password);
    const cookies = await this.createLoginSession(user.id, user.email, dto);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: this.toAuthUser(user, cookies.sessionId),
      cookies,
    };
  }

  async refresh(refreshUser: RefreshRequestUser): Promise<RefreshResult> {
    const session = await this.validateRefreshSession(refreshUser);
    const user = await this.validateRefreshUser(refreshUser);
    const cookies = await this.rotateRefreshSession(user.id, user.email, session);

    return {
      user: this.toAuthUser(user, session.sessionId),
      cookies,
    };
  }

  async logout(user: AuthUser): Promise<void> {
    await this.revokeSession(user.id, user.sessionId);
  }

  async validateAccessUser(userId: string, sessionId: string, isLogout = false): Promise<AuthUser> {
    const session = await this.getAuthSession(sessionId);

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const user = await this.findAuthUserById(userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException(INVALID_SESSION);
    }
    if (!isLogout) {
      this.assertUserCanLogin(user.activityStatus);
    }
    return this.toAuthUser(user, sessionId);
  }

  getMe(user: AuthUser): AuthUser {
    return user;
  }

  async updateMe(currentUser: AuthUser, dto: UpdateMeDto): Promise<AuthUser> {
    const { fullName, phone } = dto;
    const existingUser = await this.findExistingAuthUserById(currentUser.id);
    const nextFullName = fullName ?? existingUser.fullName;
    const nextPhone = phone ?? existingUser.phone;

    const user = await this.prisma.user.update({
      where: { id: currentUser.id },
      data: {
        fullName: nextFullName,
        phone: nextPhone,
        searchText: buildUserSearchText({
          fullName: nextFullName,
          phone: nextPhone,
        }),
      },
      include: this.userAuthInclude(),
    });

    return this.toAuthUser(user, currentUser.sessionId);
  }

  async changePassword(currentUser: AuthUser, dto: ChangePasswordDto): Promise<{ success: true }> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: currentUser.id,
        deletedAt: null,
      },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const oldPasswordValid = await bcrypt.compare(dto.oldPassword, user.passwordHash);

    if (!oldPasswordValid) {
      throw new BadRequestException(OLD_PASSWORD_NOT_VALID);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: currentUser.id },
      data: { passwordHash },
    });

    await this.revokeAllUserSessions(currentUser.id);

    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const canRequestReset = await this.checkPasswordResetRateLimit(normalizedEmail);

    if (!canRequestReset) {
      this.logger.warn(`Password reset request rate-limited for email ${normalizedEmail}`);
      return { success: true };
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        fullName: true,
        activityStatus: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || user.activityStatus !== EUserActivityStatus.Active) {
      this.logger.warn(`Failed to send password reset email because user is not active`);
      return { success: true };
    }

    const rawToken = await this.passwordResetTokenService.createForUser(user.id);
    const resetPasswordUrl = this.buildPasswordResetUrl(rawToken);
    const appName = this.configService.get<string>('MAIL_SITE_NAME', 'Rental Admin');

    try {
      await this.mailTemplateService.sendTemplateEmail({
        key: MailTemplateKey.AuthResetPassword,
        toEmail: user.email,
        payload: {
          userName: user.fullName || 'ban',
          resetPasswordUrl,
          expiresInMinutes: Math.ceil(this.configService.get<number>('RESET_PASSWORD_EXPIRES_IN_SECONDS', 1800) / 60),
          appName,
        },
        fallback: {
          subject: `Dat lai mat khau ${appName}`,
          htmlBody: this.mailService.buildPasswordResetEmailHtml(resetPasswordUrl, {
            fullName: user.fullName,
          }),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send password reset email to user ${user.id}`, error instanceof Error ? error.stack : undefined);
    }

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(PASSWORD_CONFIRM_NOT_MATCH);
    }

    const resetToken = await this.passwordResetTokenService.verify(dto.token);

    const user = await this.prisma.user.findFirst({
      where: {
        id: resetToken.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        activityStatus: true,
      },
    });

    if (!user) {
      await this.passwordResetTokenService.consume(resetToken);
      throw new BadRequestException(PASSWORD_RESET_TOKEN_INVALID);
    }

    this.assertUserCanLogin(user.activityStatus);

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await Promise.all([this.passwordResetTokenService.consume(resetToken), this.revokeAllUserSessions(user.id)]);

    return { success: true };
  }

  async verifyResetPasswordToken(token: string): Promise<{ success: true }> {
    await this.passwordResetTokenService.verify(token);

    return { success: true };
  }

  getAccessMaxAge(): number {
    return parseDurationMs(this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'));
  }

  getRefreshMaxAge(): number {
    return parseDurationMs(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'));
  }

  private async validateLoginCredentials(email: string, password: string): Promise<UserWithAuth> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: this.userAuthInclude(),
    });

    if (!user || user.deletedAt) {
      await this.recordUnknownLoginFailure(normalizedEmail);
      throw new HttpException(USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    this.assertUserCanLogin(user.activityStatus);
    await this.assertUserNotTemporarilyLocked(user.id);

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      await this.recordUserLoginFailure(user.id, normalizedEmail);
      throw new BadRequestException(PASSWORD_NOT_MATCH);
    }

    await this.clearLoginFailureCounters(user.id, normalizedEmail);

    return user;
  }

  private async validateRefreshSession(refreshUser: RefreshRequestUser): Promise<AuthSession> {
    const session = await this.getAuthSession(refreshUser.sid);

    if (!session || session.userId !== refreshUser.sub) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    if (!this.isRefreshTokenHashValid(refreshUser.refreshToken, session.refreshTokenHash)) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    return session;
  }

  private async validateRefreshUser(refreshUser: RefreshRequestUser): Promise<UserWithAuth> {
    const user = await this.findAuthUserById(refreshUser.sub);

    if (!user || user.deletedAt) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    this.assertUserCanLogin(user.activityStatus);

    return user;
  }

  private async createLoginSession(userId: string, email: string, dto: LoginDto): Promise<AuthCookiePayload> {
    const sessionId = randomUUID();
    const cookies = await this.createCookiePayload(userId, email, sessionId);
    const session = this.buildAuthSession({
      sessionId,
      userId,
      refreshToken: cookies.refreshToken,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
      deviceId: dto.deviceId,
      fcmToken: dto.fcmToken,
    });

    await this.saveAuthSession(session);

    return {
      ...cookies,
      sessionId,
    };
  }

  private async rotateRefreshSession(userId: string, email: string, session: AuthSession): Promise<AuthCookiePayload> {
    const cookies = await this.createCookiePayload(userId, email, session.sessionId);
    const nextSession = this.buildAuthSession({
      ...session,
      refreshToken: cookies.refreshToken,
      lastUsedAt: new Date(),
    });

    await this.saveAuthSession(nextSession);

    return {
      ...cookies,
      sessionId: session.sessionId,
    };
  }

  private async createCookiePayload(userId: string, email: string, sessionId: string): Promise<Omit<AuthCookiePayload, 'sessionId'>> {
    const tokens = await this.issueTokens(userId, email, sessionId);

    return {
      ...tokens,
      accessMaxAge: this.getAccessMaxAge(),
      refreshMaxAge: this.getRefreshMaxAge(),
    };
  }

  private buildAuthSession(input: {
    sessionId: string;
    userId: string;
    refreshToken: string;
    createdAt?: string;
    lastUsedAt?: string | Date;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    fcmToken?: string;
  }): AuthSession {
    const now = new Date();
    const createdAt = input.createdAt ?? now.toISOString();
    const lastUsedAt = input.lastUsedAt instanceof Date ? input.lastUsedAt.toISOString() : (input.lastUsedAt ?? now.toISOString());
    const expiresAt = new Date(now.getTime() + this.getRefreshMaxAge()).toISOString();

    return {
      sessionId: input.sessionId,
      userId: input.userId,
      refreshTokenHash: this.hashRefreshToken(input.refreshToken),
      createdAt,
      lastUsedAt,
      expiresAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceId: input.deviceId,
      fcmToken: input.fcmToken,
    };
  }

  private async saveAuthSession(session: AuthSession): Promise<void> {
    const ttlSeconds = this.getRefreshTTLSeconds();
    const sessionKey = REDIS_KEYS.auth.session(session.sessionId);
    const userSessionsKey = REDIS_KEYS.auth.userSessions(session.userId);

    await Promise.all([
      this.redis.setJson(sessionKey, session, ttlSeconds),
      this.redis.sadd(userSessionsKey, session.sessionId),
      this.redis.expire(userSessionsKey, ttlSeconds),
    ]);
  }

  private async getAuthSession(sessionId: string): Promise<AuthSession | null> {
    return this.redis.getJson<AuthSession>(REDIS_KEYS.auth.session(sessionId));
  }

  private async revokeSession(userId: string, sessionId: string): Promise<void> {
    await Promise.all([this.redis.del(REDIS_KEYS.auth.session(sessionId)), this.redis.srem(REDIS_KEYS.auth.userSessions(userId), sessionId)]);
  }

  private async revokeAllUserSessions(userId: string): Promise<void> {
    const userSessionsKey = REDIS_KEYS.auth.userSessions(userId);
    const sessionIds = await this.redis.smembers(userSessionsKey);
    const sessionKeys = sessionIds.map((sessionId) => REDIS_KEYS.auth.session(sessionId));

    await this.redis.del(...sessionKeys, userSessionsKey);
  }

  private async findAuthUserById(userId: string): Promise<UserWithAuth | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userAuthInclude(),
    });
  }

  private async findExistingAuthUserById(userId: string): Promise<UserWithAuth> {
    const user = await this.findAuthUserById(userId);

    if (!user || user.deletedAt) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    this.assertUserCanLogin(user.activityStatus);

    return user;
  }

  private async ensureEmailAvailable(email: string, excludedUserId?: string): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== excludedUserId) {
      throw new BadRequestException(USER_EMAIL_EXISTED);
    }
  }

  private async issueTokens(userId: string, email: string, sessionId: string) {
    const accessPayload: JwtAccessPayload = {
      sub: userId,
      email,
      sid: sessionId,
      type: 'access',
    };
    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      sid: sessionId,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.getAccessMaxAge() / 1000,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.getRefreshMaxAge() / 1000,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHmac('sha256', this.configService.getOrThrow<string>('JWT_REFRESH_SECRET')).update(refreshToken).digest('hex');
  }

  private isRefreshTokenHashValid(refreshToken: string, expectedHash: string): boolean {
    const actualHash = this.hashRefreshToken(refreshToken);
    const actual = Buffer.from(actualHash, 'hex');
    const expected = Buffer.from(expectedHash, 'hex');

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private getRefreshTTLSeconds(): number {
    return Math.ceil(this.getRefreshMaxAge() / 1000);
  }

  private buildPasswordResetUrl(token: string): string {
    const adminOrigin = this.configService.get<string>('ADMIN_WEB_ORIGIN', 'http://localhost:3001').replace(/\/$/, '');
    return `${adminOrigin}/auth/reset-password?token=${encodeURIComponent(token)}`;
  }

  private assertUserCanLogin(activityStatus: EUserActivityStatus): void {
    if (activityStatus === EUserActivityStatus.Active) {
      return;
    }

    const error = USER_ACTIVITY_ERRORS[activityStatus as Exclude<EUserActivityStatus, typeof EUserActivityStatus.Active>];
    throw new UnauthorizedException(error ?? INVALID_SESSION);
  }

  private async assertUserNotTemporarilyLocked(userId: string): Promise<void> {
    const isLocked = await this.redis.exists(REDIS_KEYS.auth.userLock(userId));

    if (isLocked) {
      throw new UnauthorizedException(USER_ACTIVITY_ERRORS[EUserActivityStatus.Locked]);
    }
  }

  private async recordUnknownLoginFailure(normalizedEmail: string): Promise<void> {
    await this.redis.incrWithTTL(REDIS_KEYS.auth.loginAttemptEmail(normalizedEmail), REDIS_EXPIRE.LOGIN_ATTEMPT);
  }

  private async checkPasswordResetRateLimit(normalizedEmail: string): Promise<boolean> {
    const requests = await this.redis.incrWithTTL(REDIS_KEYS.auth.resetPasswordRateLimit(normalizedEmail), REDIS_EXPIRE.RESET_PASSWORD_RATE_LIMIT);

    return requests <= this.getPasswordResetRateLimit();
  }

  private async recordUserLoginFailure(userId: string, normalizedEmail: string): Promise<void> {
    const maxFailures = this.getMaxLoginFailures();
    const [userFailures] = await Promise.all([
      this.redis.incrWithTTL(REDIS_KEYS.auth.loginAttemptUser(userId), REDIS_EXPIRE.LOGIN_ATTEMPT),
      this.redis.incrWithTTL(REDIS_KEYS.auth.loginAttemptEmail(normalizedEmail), REDIS_EXPIRE.LOGIN_ATTEMPT),
    ]);

    if (userFailures < maxFailures) {
      return;
    }

    await Promise.all([
      this.redis.set(REDIS_KEYS.auth.userLock(userId), '1', REDIS_EXPIRE.AUTH_LOCK),
      this.prisma.user.update({
        where: { id: userId },
        data: { activityStatus: EUserActivityStatus.Locked },
      }),
    ]);
  }

  private async clearLoginFailureCounters(userId: string, normalizedEmail: string): Promise<void> {
    await this.redis.del(REDIS_KEYS.auth.loginAttemptUser(userId), REDIS_KEYS.auth.loginAttemptEmail(normalizedEmail));
  }

  private getMaxLoginFailures(): number {
    return this.configService.get<number>('AUTH_MAX_LOGIN_FAILURES', 5);
  }

  private getPasswordResetRateLimit(): number {
    return this.configService.get<number>('AUTH_PASSWORD_RESET_RATE_LIMIT', 3);
  }

  private toAuthUser(user: UserWithAuth, sessionId: string): AuthUser {
    const roles = user.roles.map(({ role }) => role.code);
    const permissions = [...new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)))];

    const authUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      roles,
      permissions,
    } as AuthUser;

    Object.defineProperty(authUser, 'sessionId', {
      value: sessionId,
      enumerable: false,
      writable: false,
    });

    return authUser;
  }

  private userAuthInclude() {
    return {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    } as const;
  }
}
