import { Module } from '@nestjs/common';
import { RentalOrdersModule } from '../rental-orders/rental-orders.module';
import { AvailabilityController } from './availability.controller';

@Module({
  imports: [RentalOrdersModule],
  controllers: [AvailabilityController],
})
export class AvailabilityModule {}
