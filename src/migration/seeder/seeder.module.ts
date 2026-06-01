import { Module } from '@nestjs/common';
import { DatabaseModule } from '@modules/database/database.module';
import { SeederService } from './seeder.service';

@Module({
  imports: [DatabaseModule],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
