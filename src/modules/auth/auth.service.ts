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
    private readonly passwordResetTokenService: PasswordResetTokenService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.validateLoginCredentials(dto.email, dto.password);
    const cookies = await this.createCookiePayload(user.id, user.email);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: this.toAuthUser(user),
      cookies,
    };
  }

  async refresh(refreshUser: RefreshRequestUser): Promise<RefreshResult> {
    const user = await this.validateRefreshUser(refreshUser);
    const cookies = await this.createCookiePayload(user.id, user.email);

    return {
      user: this.toAuthUser(user),
      cookies,
    };
  }

  logout(): void {}
  async validateAccessUser(userId: string, isLogout = false): Promise<AuthUser> {
    const user = await this.findAuthUserById(userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException(INVALID_SESSION);
    }
    if (!isLogout) {
      this.assertUserCanLogin(user.activityStatus);
    }
    return this.toAuthUser(user);
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

    return this.toAuthUser(user);
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

    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
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

    try {
      await this.mailService.sendPasswordResetEmail(user.email, this.buildPasswordResetUrl(rawToken), {
        fullName: user.fullName,
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

    await this.passwordResetTokenService.consume(resetToken);

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

  private async validateRefreshUser(refreshUser: RefreshRequestUser): Promise<UserWithAuth> {
    const user = await this.findAuthUserById(refreshUser.sub);

    if (!user || user.deletedAt) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    this.assertUserCanLogin(user.activityStatus);

    return user;
  }

  private async createCookiePayload(userId: string, email: string): Promise<AuthCookiePayload> {
    const tokens = await this.issueTokens(userId, email);

    return {
      ...tokens,
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

  private async issueTokens(userId: string, email: string) {
    const accessPayload: JwtAccessPayload = {
      sub: userId,
      email,
      type: 'access',
    };
    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
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

  private toAuthUser(user: UserWithAuth): AuthUser {
    const roles = user.roles.map(({ role }) => role.code);
    const permissions = [...new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)))];

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
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
