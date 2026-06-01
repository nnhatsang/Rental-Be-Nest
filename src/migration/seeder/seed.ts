import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SeederModule } from './seeder.module';
import { SeederService } from './seeder.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeederModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const seeder = app.get(SeederService);
    await seeder.seed();
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  new Logger('Seeder').error(error);
  process.exit(1);
});
