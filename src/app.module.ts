import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@modules/database/database.module';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { AssetUnitsModule } from './modules/asset-units/asset-units.module';
import { RentalPolicyModule } from './modules/rental-policy/rental-policy.module';
import { StoreBusinessHoursModule } from './modules/store-business-hours/store-business-hours.module';
import { StoreClosureModule } from './modules/store-closure/store-closure.module';
import { RentalOrdersModule } from './modules/rental-orders/rental-orders.module';
import * as Joi from 'joi';
@Module({
  imports: [
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

        AUTH_COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
        AUTH_COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
        ADMIN_WEB_ORIGIN: Joi.string().default('http://localhost:3001'),
      }),
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    ProductsModule,
    AssetUnitsModule,
    RentalPolicyModule,
    StoreBusinessHoursModule,
    StoreClosureModule,
    RentalOrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
