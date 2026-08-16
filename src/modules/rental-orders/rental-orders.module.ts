import { Module } from '@nestjs/common';
import { RentalOrdersService } from './rental-orders.service';
import { RentalOrdersController } from './rental-orders.controller';
import { RentalOrderAvailabilityService } from './services/rental-order-availability.service';
import { RentalOrderPricingService } from './services/rental-order-pricing.service';
import { RentalOrderRealtimeService } from './services/rental-order-realtime.service';
import { RentalOrderEventsService } from './services/rental-order-events.service';
import { RentalOrderPaymentsService } from './services/rental-order-payments.service';
import { RentalOrderWorkflowService } from './services/rental-order-workflow.service';
import { RentalOrderLogsService } from './services/rental-order-logs.service';
import { CustomersModule } from '../customers/customers.module';
import { ProductsModule } from '../products/products.module';
import { AssetUnitsModule } from '../asset-units/asset-units.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { StoreBusinessHoursModule } from '../store-business-hours/store-business-hours.module';
import { StoreClosureModule } from '../store-closure/store-closure.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    CustomersModule,
    ProductsModule,
    AssetUnitsModule,
    SystemSettingsModule,
    StoreBusinessHoursModule,
    StoreClosureModule,
    UsersModule,
  ],
  controllers: [RentalOrdersController],
  providers: [
    RentalOrdersService,
    RentalOrderAvailabilityService,
    RentalOrderPricingService,
    RentalOrderRealtimeService,
    RentalOrderEventsService,
    RentalOrderWorkflowService,
    RentalOrderPaymentsService,
    RentalOrderLogsService,
  ],
  exports: [RentalOrdersService, RentalOrderAvailabilityService],
})
export class RentalOrdersModule {}
