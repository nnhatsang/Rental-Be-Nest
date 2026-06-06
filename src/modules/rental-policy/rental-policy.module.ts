import { Module } from '@nestjs/common';
import { RentalPolicyService } from './rental-policy.service';
import { RentalPolicyController } from './rental-policy.controller';

@Module({
  controllers: [RentalPolicyController],
  providers: [RentalPolicyService],
  exports: [RentalPolicyService],
})
export class RentalPolicyModule {}
