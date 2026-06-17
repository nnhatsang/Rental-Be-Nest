import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@modules/database/prisma.service';
import { GetAllUsersInDto } from './dto/get-all-users.in.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserActivityStatusDto } from './dto/update-user-activity-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UserOutDto } from './dto/user-out.dto';
import { RoleCode } from '@/libs/constants/rbac.constant';
import {
  INVALID_USER,
  PASSWORD_CONFIRM_NOT_MATCH,
  ROLE_NOT_FOUND,
  USER_EMAIL_EXISTED,
  USER_SELF_DELETE_NOT_ALLOWED,
  USER_SELF_PASSWORD_RESET_NOT_ALLOWED,
} from '@/libs/constants/error.constants';
import { buildUserSearchText, normalizeSearchText } from '@/libs/utils/search-text.util';

type UserWithRoles = Awaited<ReturnType<UsersService['findUserWithRolesById']>>;
type ExistingUserWithRoles = NonNullable<UserWithRoles>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUsers(query: GetAllUsersInDto) {
    const { page, perPage, roleCode, search, status } = query;
    const skip = (page - 1) * perPage;
    const searchText = normalizeSearchText(search);
    const where = {
      deletedAt: null,
      ...(status && {
        activityStatus: status,
      }),
      ...(searchText && {
        searchText: {
          contains: searchText,
        },
      }),
      ...(roleCode && {
        roles: {
          some: {
            role: {
              code: roleCode,
            },
          },
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: perPage,
        orderBy: {
          createdAt: 'desc',
        },
        include: this.userRolesInclude(),
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => this.toUserOut(user)),
      total,
      page,
      perPage,
    };
  }

  async getUserById(id: string): Promise<UserOutDto> {
    const user = await this.findExistingUserWithRolesById(id);
    return this.toUserOut(user);
  }

  async createUser(dto: CreateUserDto): Promise<UserOutDto> {
    await this.ensureEmailAvailable(dto.email);

    const roleCodes = dto.roleCodes?.length ? dto.roleCodes : [RoleCode.Staff];
    const roles = await this.findRolesByCodesOrThrow(roleCodes);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        searchText: buildUserSearchText({
          email: dto.email,
          fullName: dto.fullName,
          phone: dto.phone,
        }),
        passwordHash,
        roles: {
          createMany: {
            data: roles.map((role) => ({ roleId: role.id })),
            skipDuplicates: true,
          },
        },
      },
      include: this.userRolesInclude(),
    });

    return this.toUserOut(user);
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserOutDto> {
    const { email, fullName, phone } = dto;
    const existingUser = await this.findExistingUserWithRolesById(id);
    const nextEmail = email ?? existingUser.email;
    const nextFullName = fullName ?? existingUser.fullName;
    const nextPhone = phone ?? existingUser.phone;

    if (email) {
      await this.ensureEmailAvailable(email, id);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email,
        fullName,
        phone,
        searchText: buildUserSearchText({
          email: nextEmail,
          fullName: nextFullName,
          phone: nextPhone,
        }),
      },
      include: this.userRolesInclude(),
    });

    return this.toUserOut(user);
  }

  async updateUserActivityStatus(id: string, dto: UpdateUserActivityStatusDto): Promise<UserOutDto> {
    await this.ensureUserExists(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        activityStatus: dto.activityStatus,
      },
      include: this.userRolesInclude(),
    });

    return this.toUserOut(user);
  }

  async updateUserRoles(id: string, dto: UpdateUserRolesDto, assignedById?: string): Promise<UserOutDto> {
    await this.ensureUserExists(id);

    const roles = await this.findRolesByCodesOrThrow(dto.roleCodes);

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId: id },
      });

      await tx.userRole.createMany({
        data: roles.map((role) => ({
          userId: id,
          roleId: role.id,
          assignedById,
        })),
        skipDuplicates: true,
      });

      return tx.user.findUnique({
        where: { id },
        include: this.userRolesInclude(),
      });
    });

    if (!user) {
      throw new NotFoundException(INVALID_USER);
    }

    return this.toUserOut(user);
  }

  async resetUserPassword(id: string, currentUserId: string, dto: ResetUserPasswordDto): Promise<{ success: true }> {
    if (id === currentUserId) {
      throw new BadRequestException(USER_SELF_PASSWORD_RESET_NOT_ALLOWED);
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(PASSWORD_CONFIRM_NOT_MATCH);
    }

    await this.ensureUserExists(id);

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { success: true };
  }

  async deleteUser(id: string, currentUserId: string): Promise<{ success: true }> {
    if (id === currentUserId) {
      throw new BadRequestException(USER_SELF_DELETE_NOT_ALLOWED);
    }

    await this.ensureUserExists(id);

    const deletedAt = new Date();
    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt,
      },
    });

    return { success: true };
  }

  private async ensureUserExists(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(INVALID_USER);
    }
  }

  private async findExistingUserWithRolesById(id: string): Promise<ExistingUserWithRoles> {
    const user = await this.findUserWithRolesById(id);

    if (!user) {
      throw new NotFoundException(INVALID_USER);
    }

    return user;
  }

  private async findUserWithRolesById(id: string) {
    return this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: this.userRolesInclude(),
    });
  }

  private async findRolesByCodesOrThrow(roleCodes: string[]) {
    const uniqueRoleCodes = [...new Set(roleCodes)];
    const roles = await this.prisma.role.findMany({
      where: {
        code: {
          in: uniqueRoleCodes,
        },
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (roles.length !== uniqueRoleCodes.length) {
      throw new BadRequestException(ROLE_NOT_FOUND);
    }

    return roles;
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

  private toUserOut(user: ExistingUserWithRoles): UserOutDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      activityStatus: user.activityStatus,
      roles: user.roles.map(({ role }) => ({
        id: role.id,
        code: role.code,
        name: role.name,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }

  private userRolesInclude() {
    return {
      roles: {
        include: {
          role: true,
        },
      },
    } as const;
  }
}
