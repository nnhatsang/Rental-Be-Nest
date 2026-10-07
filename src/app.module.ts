import { RedisModule } from '@liaoliaots/nestjs-redis';
import { AuthModule } from '@modules/auth/auth.module';
import { DatabaseModule } from '@modules/database/database.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueueModule } from './libs/queue/queue.module';
import { RedisWrapperModule } from './libs/redis/redis.module';
import { SocketModule } from './libs/socket/socket.module';
import { AssetUnitsModule } from './modules/asset-units/asset-units.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FileStorageModule } from './modules/file-storage/file-storage.module';
import { MailTemplateModule } from './modules/mail-template/mail-template.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ProductsModule } from './modules/products/products.module';
import { RentalOrdersModule } from './modules/rental-orders/rental-orders.module';
import { RolesModule } from './modules/roles/roles.module';
import { StoreBusinessHoursModule } from './modules/store-business-hours/store-business-hours.module';
import { StoreClosureModule } from './modules/store-closure/store-closure.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 200,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().required(),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),

        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        AUTH_MAX_LOGIN_FAILURES: Joi.number().default(5),
        AUTH_PASSWORD_RESET_RATE_LIMIT: Joi.number().default(3),

        AUTH_COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
        AUTH_COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
        ADMIN_WEB_ORIGIN: Joi.string().default('http://localhost:3000'),

        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow('').optional(),

        RESET_PASSWORD_EXPIRES_IN_SECONDS: Joi.number().default(1800),
        RESET_PASSWORD_SECRET: Joi.string().required(),

        SMTP_HOST: Joi.string().allow('').optional(),
        SMTP_PORT: Joi.number().default(587),
        SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
        SMTP_USER: Joi.string().allow('').optional(),
        SMTP_PASS: Joi.string().allow('').optional(),
        MAIL_FROM: Joi.string().default('Rental Admin <no-reply@rental.local>'),

        // Optional during local development; the file module returns a clear 503 until configured.
        R2_ACCOUNT_ID: Joi.string().allow('').optional(),
        R2_ACCESS_KEY_ID: Joi.string().allow('').optional(),
        R2_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
        R2_BUCKET_NAME: Joi.string().allow('').optional(),
        R2_PRESIGN_EXPIRES_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
      }),
    }),
    RedisModule.forRootAsync(
      {
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          closeClient: true,
          config: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            // password: configService.get<string>('REDIS_PASSWORD') || undefined,
          },
        }),
      },
      true,
    ),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    ProductsModule,
    CategoriesModule,
    BrandsModule,
    AssetUnitsModule,
    SystemSettingsModule,
    StoreBusinessHoursModule,
    StoreClosureModule,
    RentalOrdersModule,
    RolesModule,
    PermissionsModule,
    SocketModule,
    RedisWrapperModule,
    MailTemplateModule,
    QueueModule,
    AvailabilityModule,
    DashboardModule,
    FileStorageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
