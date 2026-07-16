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
    await this.seedRentalPolicy();
    await this.seedStoreBusinessHours();
    await this.seedEmailTemplates();
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

  private async seedRentalPolicy() {
    await this.prisma.rentalPolicy.upsert({
      where: {
        code: 'DEFAULT',
      },
      update: {},
      create: {
        code: 'DEFAULT',
        name: 'Default Rental Policy',
        bookingHoldAmountPerUnit: 50000,
        turnaroundMinutes: 60,
      },
    });

    this.logger.log('Rental policy seeded');
  }

  private async seedStoreBusinessHours() {
    const businessHours = [
      {
        dayOfWeek: 0,
        openTime: '08:00',
        closeTime: '18:00',
        isOpen: false,
      },
      {
        dayOfWeek: 1,
        openTime: '08:00',
        closeTime: '20:00',
        isOpen: true,
      },
      {
        dayOfWeek: 2,
        openTime: '08:00',
        closeTime: '20:00',
        isOpen: true,
      },
      {
        dayOfWeek: 3,
        openTime: '08:00',
        closeTime: '20:00',
        isOpen: true,
      },
      {
        dayOfWeek: 4,
        openTime: '08:00',
        closeTime: '20:00',
        isOpen: true,
      },
      {
        dayOfWeek: 5,
        openTime: '08:00',
        closeTime: '20:00',
        isOpen: true,
      },
      {
        dayOfWeek: 6,
        openTime: '08:00',
        closeTime: '18:00',
        isOpen: true,
      },
    ];

    for (const businessHour of businessHours) {
      await this.prisma.storeBusinessHour.upsert({
        where: {
          dayOfWeek: businessHour.dayOfWeek,
        },
        update: {},
        create: businessHour,
      });
    }

    this.logger.log('Store business hours seeded');
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

  private async seedEmailTemplates() {
    const defaultLayout = await this.prisma.emailLayout.upsert({
      where: {
        key: 'default',
      },
      update: {
        name: 'Default email layout',
        htmlLayout: [
          '<!DOCTYPE html>',
          '<html>',
          '<head><meta charset="utf-8"><title>{{appName}}</title></head>',
          '<body style="font-family: Arial, sans-serif; color: #111827; background: #f9fafb; margin: 0; padding: 24px;">',
          '<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; padding: 24px;">',
          '<h2 style="margin-top: 0;">{{appName}}</h2>',
          '{{content}}',
          '<p style="font-size: 12px; color: #6b7280; margin-top: 24px;">Neu ban khong yeu cau thao tac nay, hay bo qua email nay.</p>',
          '</div>',
          '</body>',
          '</html>',
        ].join('\n'),
        isActive: true,
      },
      create: {
        key: 'default',
        name: 'Default email layout',
        htmlLayout: [
          '<!DOCTYPE html>',
          '<html>',
          '<head><meta charset="utf-8"><title>{{appName}}</title></head>',
          '<body style="font-family: Arial, sans-serif; color: #111827; background: #f9fafb; margin: 0; padding: 24px;">',
          '<div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; padding: 24px;">',
          '<h2 style="margin-top: 0;">{{appName}}</h2>',
          '{{content}}',
          '<p style="font-size: 12px; color: #6b7280; margin-top: 24px;">Neu ban khong yeu cau thao tac nay, hay bo qua email nay.</p>',
          '</div>',
          '</body>',
          '</html>',
        ].join('\n'),
      },
    });

    await this.prisma.emailTemplate.upsert({
      where: {
        key: 'auth.reset_password',
      },
      update: {
        name: 'Reset password',
        layoutId: defaultLayout.id,
        description: 'Password reset email sent from forgot password flow',
        variables: ['userName', 'resetPasswordUrl', 'expiresInMinutes', 'appName'],
      },
      create: {
        key: 'auth.reset_password',
        name: 'Reset password',
        layoutId: defaultLayout.id,
        subject: 'Dat lai mat khau {{appName}}',
        htmlBody: [
          '<p>Xin chao <strong>{{userName}}</strong>,</p>',
          '<p>Ban vua yeu cau dat lai mat khau cho tai khoan tai {{appName}}.</p>',
          '<p>Link nay co hieu luc trong {{expiresInMinutes}} phut.</p>',
          '<p><a href="{{resetPasswordUrl}}">Dat lai mat khau</a></p>',
        ].join('\n'),
        description: 'Password reset email sent from forgot password flow',
        variables: ['userName', 'resetPasswordUrl', 'expiresInMinutes', 'appName'],
      },
    });

    this.logger.log('Email templates seeded');
  }

  private toDisplayName(code: string) {
    return code
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, ' '))
      .join(' ');
  }
}
