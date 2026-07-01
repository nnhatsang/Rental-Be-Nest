import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Global module — import 1 lần trong AppModule, dùng được ở mọi nơi
 * mà không cần import lại trong từng feature module.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisWrapperModule {}
