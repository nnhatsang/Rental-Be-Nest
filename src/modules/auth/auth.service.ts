import { randomBytes } from 'crypto';
import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { PrismaService } from '@modules/database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import {
  AuthCookiePayload,
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
  PASSWORD_NOT_MATCH,
  UNAUTHORIZED,
  USER_ACTIVITY_ERRORS,
  USER_EMAIL_EXISTED,
  USER_NOT_FOUND,
} from '@/libs/constants/error.constants';
import { buildUserSearchText } from '@/libs/utils/search-text.util';
import { AuthSession, User } from '@generated/prisma/browser';

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

type SessionWithUser = AuthSession & {
  user: UserWithAuth;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto, request: Request): Promise<LoginResult> {
    const user = await this.validateLoginCredentials(dto.email, dto.password);
    const session = await this.createAuthSession(user.id, request);
    const cookies = await this.createCookiePayload(user.id, user.email, session.id);

    await Promise.all([
      this.saveSessionTokens(session.id, cookies),
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    return {
      user: this.toAuthUser(user, session.id),
      cookies,
    };
  }

  async refresh(refreshUser: RefreshRequestUser): Promise<RefreshResult> {
    const session = await this.validateRefreshSession(refreshUser);
    const cookies = await this.createCookiePayload(session.user.id, session.user.email, session.id);

    await this.saveSessionTokens(session.id, cookies);

    return { cookies };
  }

  async logout(user: AuthUser): Promise<void> {
    await this.revokeSession(user.sessionId);
  }

  async validateAccessSession(userId: string, sessionId: string): Promise<AuthUser> {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        isRevoked: true,
        expiresAt: true,
      },
    });

    this.assertSessionIsUsable(session, userId);

    const user = await this.findAuthUserById(userId);

    if (!user || user.deletedAt) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    this.assertUserCanLogin(user.activityStatus);

    return this.toAuthUser(user, sessionId);
  }

  getMe(user: AuthUser): AuthUser {
    return user;
  }

  async updateMe(currentUser: AuthUser, dto: UpdateMeDto): Promise<AuthUser> {
    const { fullName, phone } = dto;
    const existingUser = await this.findExistingAuthUserById(currentUser.id);
    // const nextEmail = dto.email ?? existingUser.email;
    const nextFullName = fullName ?? existingUser.fullName;
    const nextPhone = phone ?? existingUser.phone;

    // if (dto.email) {
    //   await this.ensureEmailAvailable(dto.email, currentUser.id);
    // }

    const user = await this.prisma.user.update({
      where: { id: currentUser.id },
      data: {
        // email: dto.email,
        fullName: nextFullName,
        phone: nextPhone,
        searchText: buildUserSearchText({
          // email: nextEmail,
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

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: currentUser.id },
        data: { passwordHash },
      }),
      this.prisma.authSession.updateMany({
        where: {
          userId: currentUser.id,
          id: {
            not: currentUser.sessionId,
          },
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      }),
    ]);

    return { success: true };
  }

  getAccessMaxAge(): number {
    return parseDurationMs(this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'));
  }

  getRefreshMaxAge(): number {
    return parseDurationMs(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'));
  }

  private async validateLoginCredentials(email: string, password: string): Promise<UserWithAuth> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: this.userAuthInclude(),
    });

    if (!user || user.deletedAt) {
      throw new HttpException(USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    this.assertUserCanLogin(user.activityStatus);

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      throw new BadRequestException(PASSWORD_NOT_MATCH);
    }

    return user;
  }

  private async validateRefreshSession(refreshUser: RefreshRequestUser): Promise<SessionWithUser> {
    const session = await this.prisma.authSession.findUnique({
      where: { id: refreshUser.sessionId },
      include: {
        user: {
          include: this.userAuthInclude(),
        },
      },
    });

    if (!session || session.userId !== refreshUser.sub || session.isRevoked || session.expiresAt <= new Date() || session.user.deletedAt) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    this.assertUserCanLogin(session.user.activityStatus);

    const refreshValid = await bcrypt.compare(refreshUser.refreshToken, session.refreshTokenHash);

    if (!refreshValid) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException(INVALID_SESSION);
    }

    return session;
  }

  private async createAuthSession(userId: string, request: Request): Promise<AuthSession> {
    return this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: '',
        csrfTokenHash: '',
        expiresAt: new Date(Date.now() + this.getRefreshMaxAge()),
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      },
    });
  }

  private async saveSessionTokens(sessionId: string, cookies: AuthCookiePayload): Promise<void> {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: await bcrypt.hash(cookies.refreshToken, 10),
        csrfTokenHash: await bcrypt.hash(cookies.csrfToken, 10),
        expiresAt: new Date(Date.now() + cookies.refreshMaxAge),
        lastUsedAt: new Date(),
      },
    });
  }

  private async createCookiePayload(userId: string, email: string, sessionId: string): Promise<AuthCookiePayload> {
    const tokens = await this.issueTokens(userId, email, sessionId);

    return {
      ...tokens,
      csrfToken: this.generateOpaqueToken(),
      accessMaxAge: this.getAccessMaxAge(),
      refreshMaxAge: this.getRefreshMaxAge(),
    };
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

  private assertSessionIsUsable(
    session: { userId: string; isRevoked: boolean; expiresAt: Date } | null,
    expectedUserId: string,
  ): asserts session is { userId: string; isRevoked: boolean; expiresAt: Date } {
    if (!session || session.userId !== expectedUserId || session.isRevoked || session.expiresAt <= new Date()) {
      throw new UnauthorizedException(INVALID_SESSION);
    }
  }

  private async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  private async issueTokens(userId: string, email: string, sessionId: string) {
    const accessPayload: JwtAccessPayload = {
      sub: userId,
      email,
      sessionId,
      type: 'access',
    };
    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      sessionId,
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

  private generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private assertUserCanLogin(activityStatus: EUserActivityStatus): void {
    if (activityStatus === EUserActivityStatus.Active) {
      return;
    }

    const error = USER_ACTIVITY_ERRORS[activityStatus as Exclude<EUserActivityStatus, typeof EUserActivityStatus.Active>];
    throw new UnauthorizedException(error ?? INVALID_SESSION);
  }

  private toAuthUser(user: UserWithAuth, sessionId: string): AuthUser {
    const roles = user.roles.map(({ role }) => role.code);
    const permissions = [...new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)))];

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      sessionId,
      roles,
      permissions,
    };
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
