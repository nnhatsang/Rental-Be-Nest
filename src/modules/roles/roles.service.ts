import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@modules/database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { GetAllRolesDto } from './dto/get-all-roles.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { AssignRoleUsersDto } from './dto/assign-role-users.dto';
import { RoleOutDto } from './dto/role-out.dto';
import {
  ROLE_CODE_EXISTED,
  ROLE_IN_USE,
  ROLE_NOT_FOUND,
  ROLE_PERMISSION_INVALID,
  ROLE_SYSTEM_PROTECTED,
  ROLE_USER_INVALID,
} from '@/libs/constants/error.constants';
import { RoleCode } from '@/libs/constants/rbac.constant';

type RoleWithRelations = Awaited<ReturnType<RolesService['findRoleById']>>;
type ExistingRoleWithRelations = NonNullable<RoleWithRelations>;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllRoles(query: GetAllRolesDto) {
    const { page, perPage, search, isSystem } = query;
    const skip = (page - 1) * perPage;
    const where = {
      ...(isSystem !== undefined && { isSystem }),
      ...(search && {
        OR: [
          { code: { contains: search } },
          { name: { contains: search } },
          { description: { contains: search } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        skip,
        take: perPage,
        orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
        include: this.roleInclude(false),
      }),
      this.prisma.role.count({ where }),
    ]);

    return {
      items: items.map((role) => this.toRoleOut(role)),
      total,
      page,
      perPage,
    };
  }

  async getRoleById(id: string): Promise<RoleOutDto> {
    const role = await this.findExistingRoleById(id, true);
    return this.toRoleOut(role);
  }

  async createRole(dto: CreateRoleDto): Promise<RoleOutDto> {
    const code = dto.code.trim().toUpperCase();
    await this.ensureRoleCodeAvailable(code);
    const permissions = await this.findPermissionsByCodesOrThrow(dto.permissionCodes);

    const role = await this.prisma.$transaction(async (tx) => {
      const createdRole = await tx.role.create({
        data: {
          code,
          name: dto.name,
          description: dto.description,
          isSystem: false,
        },
      });

      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: createdRole.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });

      return tx.role.findUnique({
        where: { id: createdRole.id },
        include: this.roleInclude(true),
      });
    });

    if (!role) {
      throw new NotFoundException(ROLE_NOT_FOUND);
    }

    return this.toRoleOut(role);
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleOutDto> {
    const role = await this.findExistingRoleById(id);
    this.assertCustomRole(role);

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: this.roleInclude(true),
    });

    return this.toRoleOut(updatedRole);
  }

  async updateRolePermissions(id: string, dto: UpdateRolePermissionsDto): Promise<RoleOutDto> {
    const role = await this.findExistingRoleById(id);
    this.assertCustomRole(role);
    const permissions = await this.findPermissionsByCodesOrThrow(dto.permissionCodes);

    const updatedRole = await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId: id },
      });

      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });

      return tx.role.findUnique({
        where: { id },
        include: this.roleInclude(true),
      });
    });

    if (!updatedRole) {
      throw new NotFoundException(ROLE_NOT_FOUND);
    }

    return this.toRoleOut(updatedRole);
  }

  async assignRoleUsers(dto: AssignRoleUsersDto, assignedById: string): Promise<RoleOutDto> {
    const roleId = dto.roleId;
    const existingRole = await this.findExistingRoleById(roleId);
    const uniqueUserIds = [...new Set(dto.userIds)];

    if (existingRole.code === RoleCode.Admin && uniqueUserIds.length === 0) {
      throw new BadRequestException(ROLE_SYSTEM_PROTECTED);
    }

    if (uniqueUserIds.length) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: uniqueUserIds },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (users.length !== uniqueUserIds.length) {
        throw new BadRequestException(ROLE_USER_INVALID);
      }
    }

    const role = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { roleId },
      });

      if (uniqueUserIds.length) {
        await tx.userRole.createMany({
          data: uniqueUserIds.map((userId) => ({
            userId,
            roleId,
            assignedById,
          })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: this.roleInclude(true),
      });
    });

    if (!role) {
      throw new NotFoundException(ROLE_NOT_FOUND);
    }

    return this.toRoleOut(role);
  }

  async deleteRole(id: string): Promise<{ success: true }> {
    const role = await this.findExistingRoleById(id, true);
    this.assertCustomRole(role);

    if (role._count.users > 0) {
      throw new BadRequestException(ROLE_IN_USE);
    }

    await this.prisma.role.delete({
      where: { id },
    });

    return { success: true };
  }

  private async findExistingRoleById(id: string, includeUsers = false): Promise<ExistingRoleWithRelations> {
    const role = await this.findRoleById(id, includeUsers);

    if (!role) {
      throw new NotFoundException(ROLE_NOT_FOUND);
    }

    return role;
  }

  private async findRoleById(id: string, includeUsers = false) {
    return this.prisma.role.findUnique({
      where: { id },
      include: this.roleInclude(includeUsers),
    });
  }

  private async ensureRoleCodeAvailable(code: string): Promise<void> {
    const existingRole = await this.prisma.role.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existingRole) {
      throw new BadRequestException(ROLE_CODE_EXISTED);
    }
  }

  private async findPermissionsByCodesOrThrow(permissionCodes: string[]) {
    const uniquePermissionCodes = [...new Set(permissionCodes)];
    const permissions = await this.prisma.permission.findMany({
      where: {
        code: {
          in: uniquePermissionCodes,
        },
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (permissions.length !== uniquePermissionCodes.length) {
      throw new BadRequestException(ROLE_PERMISSION_INVALID);
    }

    return permissions;
  }

  private assertCustomRole(role: { isSystem: boolean; code: string }): void {
    if (role.isSystem || Object.values(RoleCode).includes(role.code as RoleCode)) {
      throw new BadRequestException(ROLE_SYSTEM_PROTECTED);
    }
  }

  private roleInclude(includeUsers: boolean) {
    return {
      permissions: {
        include: {
          permission: true,
        },
      },
      users: includeUsers
        ? {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
          }
        : false,
      _count: {
        select: {
          users: true,
        },
      },
    } as const;
  }

  private toRoleOut(role: ExistingRoleWithRelations): RoleOutDto {
    const users = Array.isArray(role.users)
      ? (role.users as unknown as Array<{ user: { id: string; email: string; fullName: string } }>)
      : undefined;

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions
        .map(({ permission }) => ({
          id: permission.id,
          code: permission.code,
          name: permission.name,
          description: permission.description,
          module: this.getPermissionModule(permission.code),
          action: this.getPermissionAction(permission.code),
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      usersCount: role._count.users,
      users: users
        ? users.map(({ user }) => ({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
          }))
        : undefined,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  private getPermissionModule(code: string): string {
    return code.split('.')[0] ?? code;
  }

  private getPermissionAction(code: string): string {
    return code.split('.').slice(1).join('.') || code;
  }
}
