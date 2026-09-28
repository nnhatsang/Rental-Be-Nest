import { Module } from '@nestjs/common';
import { StoreBusinessHoursModule } from '../store-business-hours/store-business-hours.module';
import { StoreClosureModule } from '../store-closure/store-closure.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { AvailabilityController } from './availability.controller';
import { AvailabilityScheduleService } from './availability-schedule.service';

@Module({
  imports: [SystemSettingsModule, StoreBusinessHoursModule, StoreClosureModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityScheduleService],
})
export class AvailabilityModule {}
