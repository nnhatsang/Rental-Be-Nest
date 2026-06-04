import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@modules/database/prisma.service';
import { EUserActivityStatus } from '@/libs/constants/error.constants';
import { PERMISSION_CODES, ROLE_SEEDS, RoleCode } from '@/libs/constants/rbac.constant';
import { buildUserSearchText } from '@/libs/utils/search-text.util';

@Injectable()
export class SeederService {
  private readonly logger = new Logger(SeederService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seed() {
    await this.seedPermissions();
    await this.seedRoles();
    await this.seedDefaultAdmin();
    this.logger.log('Seeding completed');
  }

  private async seedPermissions() {
    for (const code of PERMISSION_CODES) {
      await this.prisma.permission.upsert({
        where: { code },
        update: {
          name: this.toDisplayName(code),
        },
        create: {
          code,
          name: this.toDisplayName(code),
          description: `Allows ${code}`,
        },
      });
    }

    this.logger.log('Permissions seeded');
  }

  private async seedRoles() {
    for (const roleSeed of ROLE_SEEDS) {
      const role = await this.prisma.role.upsert({
        where: { code: roleSeed.code },
        update: {
          name: roleSeed.name,
          description: roleSeed.description,
          isSystem: true,
        },
        create: {
          code: roleSeed.code,
          name: roleSeed.name,
          description: roleSeed.description,
          isSystem: true,
        },
      });

      const permissions = await this.prisma.permission.findMany({
        where: {
          code: {
            in: [...roleSeed.permissions],
          },
        },
        select: {
          id: true,
        },
      });

      await this.prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
    }

    this.logger.log('Roles seeded');
  }

  private async seedDefaultAdmin() {
    const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@rental.local';
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'Password123!';
    const fullName = process.env.SEED_ADMIN_FULL_NAME ?? 'System Admin';
    const searchText = buildUserSearchText({ email, fullName });

    const adminRole = await this.prisma.role.findUnique({
      where: { code: RoleCode.Admin },
      select: { id: true },
    });

    if (!adminRole) {
      throw new Error('ADMIN role was not seeded');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await this.prisma.user.upsert({
      where: { email },
      update: {
        fullName,
        searchText,
        activityStatus: EUserActivityStatus.Active,
      },
      create: {
        email,
        passwordHash,
        fullName,
        searchText,
        activityStatus: EUserActivityStatus.Active,
      },
    });

    await this.prisma.userRole.createMany({
      data: [
        {
          userId: admin.id,
          roleId: adminRole.id,
        },
      ],
      skipDuplicates: true,
    });

    this.logger.log(`Default admin ready: ${email}`);
  }

  private toDisplayName(code: string) {
    return code
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, ' '))
      .join(' ');
  }
}
