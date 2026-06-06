import { Module } from '@nestjs/common';
import { StoreBusinessHoursController } from './store-business-hours.controller';
import { StoreBusinessHoursService } from './store-business-hours.service';

@Module({
  controllers: [StoreBusinessHoursController],
  providers: [StoreBusinessHoursService],
  exports: [StoreBusinessHoursService],
})
export class StoreBusinessHoursModule {}
