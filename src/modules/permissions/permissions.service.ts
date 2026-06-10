import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/database/prisma.service';
import { GetAllPermissionsDto } from './dto/get-all-permissions.dto';
import { PermissionOutDto } from './dto/permission-out.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllPermissions(query: GetAllPermissionsDto): Promise<PermissionOutDto[]> {
    const permissions = await this.prisma.permission.findMany({
      where: {
        ...(query.module && {
          code: {
            startsWith: `${query.module}.`,
          },
        }),
        ...(query.search && {
          OR: [
            { code: { contains: query.search } },
            { name: { contains: query.search } },
            { description: { contains: query.search } },
          ],
        }),
      },
      orderBy: { code: 'asc' },
    });

    return permissions.map((permission) => ({
      id: permission.id,
      code: permission.code,
      name: permission.name,
      description: permission.description,
      module: this.getPermissionModule(permission.code),
      action: this.getPermissionAction(permission.code),
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    }));
  }

  private getPermissionModule(code: string): string {
    return code.split('.')[0] ?? code;
  }

  private getPermissionAction(code: string): string {
    return code.split('.').slice(1).join('.') || code;
  }
}
