import { Module } from '@nestjs/common';
import { AssetUnitsService } from './asset-units.service';
import { AssetUnitsController } from './asset-units.controller';

@Module({
  controllers: [AssetUnitsController],
  providers: [AssetUnitsService],
})
export class AssetUnitsModule {}
