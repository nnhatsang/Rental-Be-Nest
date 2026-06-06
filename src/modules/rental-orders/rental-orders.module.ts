import { Module } from '@nestjs/common';
import { RentalOrdersService } from './rental-orders.service';
import { RentalOrdersController } from './rental-orders.controller';
import { CustomersModule } from '../customers/customers.module';
import { ProductsModule } from '../products/products.module';
import { AssetUnitsModule } from '../asset-units/asset-units.module';
import { RentalPolicyModule } from '../rental-policy/rental-policy.module';
import { StoreBusinessHoursModule } from '../store-business-hours/store-business-hours.module';
import { StoreClosureModule } from '../store-closure/store-closure.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [CustomersModule, ProductsModule, AssetUnitsModule, RentalPolicyModule, StoreBusinessHoursModule, StoreClosureModule, UsersModule],
  controllers: [RentalOrdersController],
  providers: [RentalOrdersService],
  exports: [RentalOrdersService],
})
export class RentalOrdersModule {}
