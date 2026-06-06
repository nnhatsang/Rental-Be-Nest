import { Module } from '@nestjs/common';
import { StoreClosureService } from './store-closure.service';
import { StoreClosureController } from './store-closure.controller';

@Module({
  controllers: [StoreClosureController],
  providers: [StoreClosureService],
  exports: [StoreClosureService],
})
export class StoreClosureModule {}
