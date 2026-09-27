import { Module } from '@nestjs/common';
import { SystemSettingsModule } from '@/modules/system-settings/system-settings.module';
import { StoreBusinessHoursModule } from '@/modules/store-business-hours/store-business-hours.module';
import { StoreClosureModule } from '@/modules/store-closure/store-closure.module';
import { RentalOrdersController } from './rental-orders.controller';
import { RentalOrdersService } from './rental-orders.service';
import { RentalOrderAvailabilityService } from './services/rental-order-availability.service';
import { RentalOrderFinancialService } from './services/rental-order-financial.service';
import { RentalOrderPricingService } from './services/rental-order-pricing.service';

@Module({
  imports: [SystemSettingsModule, StoreBusinessHoursModule, StoreClosureModule],
  controllers: [RentalOrdersController],
  providers: [RentalOrdersService, RentalOrderAvailabilityService, RentalOrderFinancialService, RentalOrderPricingService],
  exports: [RentalOrdersService, RentalOrderAvailabilityService],
})
export class RentalOrdersModule {}
