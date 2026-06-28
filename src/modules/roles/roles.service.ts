import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@modules/database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { DeleteRolesDto } from './dto/delete-roles.dto';
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
import { SocketService } from '../socket/socket.service';
import { ESocketEmit, ESocketReason } from '@/libs/enums/socket.enum';

type RoleWithRelations = Awaited<ReturnType<RolesService['findRoleById']>>;
type ExistingRoleWithRelations = NonNullable<RoleWithRelations>;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
  ) {}

  async getAllRoles(query: GetAllRolesDto) {
    const { page, perPage, search, isSystem } = query;
    const skip = (page - 1) * perPage;
    const where = {
      ...(isSystem !== undefined && { isSystem }),
      ...(search && {
        OR: [{ code: { contains: search } }, { name: { contains: search } }, { description: { contains: search } }],
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

  async createRole(dto: CreateRoleDto, userId: string): Promise<RoleOutDto> {
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
          createdBy: userId,
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

  async updateRole(id: string, dto: UpdateRoleDto, userId: string): Promise<RoleOutDto> {
    const role = await this.findExistingRoleById(id);
    this.assertCustomRole(role);

    const code = dto.code ? dto.code.trim().toUpperCase() : undefined;
    if (code && code !== role.code) {
      await this.ensureRoleCodeAvailable(code);
    }

    const permissions = dto.permissionCodes ? await this.findPermissionsByCodesOrThrow(dto.permissionCodes) : undefined;

    const updatedRole = await this.prisma.$transaction(async (tx) => {
      const dataToUpdate: any = {
        updatedBy: userId,
      };
      if (code !== undefined) dataToUpdate.code = code;
      if (dto.name !== undefined) dataToUpdate.name = dto.name;
      if (dto.description !== undefined) dataToUpdate.description = dto.description;

      await tx.role.update({
        where: { id },
        data: dataToUpdate,
      });

      if (permissions !== undefined) {
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((permission) => ({
              roleId: id,
              permissionId: permission.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.role.findUnique({
        where: { id },
        include: this.roleInclude(true),
      });
    });

    if (!updatedRole) {
      throw new NotFoundException(ROLE_NOT_FOUND);
    }

    if (permissions !== undefined) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { roleId: id },
        select: { userId: true },
      });
      const userIds = userRoles.map((ur) => ur.userId);
      if (userIds.length > 0) {
        this.socketService.sendToUsers({
          userIds,
          eventName: ESocketEmit.PERMISSIONS_UPDATED,
          data: {
            reason: ESocketReason.ROLE_PERMISSIONS_UPDATED,
          },
        });
      }
    }

    return this.toRoleOut(updatedRole);
  }

  async updateRolePermissions(id: string, dto: UpdateRolePermissionsDto, userId: string): Promise<RoleOutDto> {
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

      await tx.role.update({
        where: { id },
        data: {
          updatedBy: userId,
        },
      });

      return tx.role.findUnique({
        where: { id },
        include: this.roleInclude(true),
      });
    });

    if (!updatedRole) {
      throw new NotFoundException(ROLE_NOT_FOUND);
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId: id },
      select: { userId: true },
    });
    const userIds = userRoles.map((ur) => ur.userId);
    if (userIds.length > 0) {
      this.socketService.sendToUsers({
        userIds,
        eventName: ESocketEmit.PERMISSIONS_UPDATED,
        data: {
          reason: ESocketReason.ROLE_PERMISSIONS_UPDATED,
        },
      });
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

    const affectedUserIds = new Set<string>();
    const prevUsers = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    prevUsers.forEach((u) => affectedUserIds.add(u.userId));
    uniqueUserIds.forEach((id) => affectedUserIds.add(id));

    const role = await this.prisma.$transaction(async (tx) => {
      if (uniqueUserIds.length) {
        await tx.userRole.deleteMany({
          where: {
            userId: { in: uniqueUserIds },
          },
        });
      }

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

    if (affectedUserIds.size > 0) {
      this.socketService.sendToUsers({
        userIds: Array.from(affectedUserIds),
        eventName: ESocketEmit.PERMISSIONS_UPDATED,
        data: {
          reason: ESocketReason.ROLE_ASSIGNMENTS_UPDATED,
        },
      });
    }

    return this.toRoleOut(role);
  }

  async multiDelete(dto: DeleteRolesDto, userId?: string): Promise<{ success: true }> {
    const { roleIds } = dto;
    const uniqueIds = [...new Set(roleIds)];

    if (uniqueIds.length === 0) {
      return { success: true };
    }

    const roles = await this.prisma.role.findMany({
      where: { id: { in: uniqueIds } },
    });

    for (const role of roles) {
      this.assertCustomRole(role);
    }

    const existingIds = roles.map((r) => r.id);
    if (existingIds.length > 0) {
      await this.prisma.role.deleteMany({
        where: { id: { in: existingIds } },
      });
    }

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
    const users = Array.isArray(role.users) ? (role.users as unknown as Array<{ user: { id: string; email: string; fullName: string } }>) : undefined;

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
