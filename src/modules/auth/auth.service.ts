import { randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { PrismaService } from '@modules/database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthUser, JwtAccessPayload, JwtRefreshPayload, RefreshRequestUser } from './types/auth-user.type';
import { clearAuthCookies, setAuthCookies } from './utils/cookie.util';
import { parseDurationMs } from './utils/duration.util';
import {
  EUserActivityStatus,
  INVALID_SESSION,
  UNAUTHORIZED,
  USER_ACTIVITY_ERRORS,
} from '@/libs/constants/error.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto, request: Request, response: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: this.userAuthInclude(),
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    this.assertUserCanLogin(user.activityStatus);

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException(UNAUTHORIZED);
    }

    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const refreshMaxAge = parseDurationMs(refreshExpiresIn);
    const csrfToken = this.generateOpaqueToken();

    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: '',
        csrfTokenHash: await bcrypt.hash(csrfToken, 10),
        expiresAt: new Date(Date.now() + refreshMaxAge),
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      },
    });

    const tokens = await this.issueTokens(user.id, user.email, session.id);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash,
        lastUsedAt: new Date(),
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    setAuthCookies(response, this.configService, {
      ...tokens,
      csrfToken,
      accessMaxAge: this.getAccessMaxAge(),
      refreshMaxAge,
    });

    return {
      user: this.toAuthUserResponse(user, session.id),
    };
  }

  async refresh(refreshUser: RefreshRequestUser, response: Response) {
    const session = await this.prisma.authSession.findUnique({
      where: { id: refreshUser.sessionId },
      include: {
        user: {
          include: this.userAuthInclude(),
        },
      },
    });

    if (
      !session ||
      session.userId !== refreshUser.sub ||
      session.isRevoked ||
      session.expiresAt <= new Date() ||
      session.user.deletedAt
    ) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    this.assertUserCanLogin(session.user.activityStatus);

    const refreshValid = await bcrypt.compare(refreshUser.refreshToken, session.refreshTokenHash);

    if (!refreshValid) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const csrfToken = this.generateOpaqueToken();
    const tokens = await this.issueTokens(session.user.id, session.user.email, session.id);
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const refreshMaxAge = parseDurationMs(refreshExpiresIn);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10),
        csrfTokenHash: await bcrypt.hash(csrfToken, 10),
        expiresAt: new Date(Date.now() + refreshMaxAge),
        lastUsedAt: new Date(),
      },
    });

    setAuthCookies(response, this.configService, {
      ...tokens,
      csrfToken,
      accessMaxAge: this.getAccessMaxAge(),
      refreshMaxAge,
    });

    return { success: true };
  }

  async logout(user: AuthUser, response: Response) {
    await this.revokeSession(user.sessionId);
    clearAuthCookies(response, this.configService);

    return { success: true };
  }

  async getAuthenticatedUser(userId: string, sessionId: string): Promise<AuthUser> {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        isRevoked: true,
        expiresAt: true,
      },
    });

    if (!session || session.userId !== userId || session.isRevoked || session.expiresAt <= new Date()) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userAuthInclude(),
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    this.assertUserCanLogin(user.activityStatus);

    return this.toAuthUserResponse(user, sessionId);
  }

  getMe(user: AuthUser) {
    return user;
  }

  private async revokeSession(sessionId: string) {
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
        expiresIn: parseDurationMs(this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d')) / 1000,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private getAccessMaxAge() {
    return parseDurationMs(this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'));
  }

  private generateOpaqueToken() {
    return randomBytes(32).toString('base64url');
  }

  private assertUserCanLogin(activityStatus: EUserActivityStatus) {
    if (activityStatus === EUserActivityStatus.Active) {
      return;
    }

    const error = USER_ACTIVITY_ERRORS[activityStatus as Exclude<EUserActivityStatus, typeof EUserActivityStatus.Active>];
    throw new UnauthorizedException(error ?? INVALID_SESSION);
  }

  private toAuthUserResponse(
    user: {
      id: string;
      email: string;
      fullName: string;
      activityStatus: EUserActivityStatus;
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
    },
    sessionId: string,
  ): AuthUser {
    const roles = user.roles.map(({ role }) => role.code);
    const permissions = [
      ...new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code))),
    ];

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
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
