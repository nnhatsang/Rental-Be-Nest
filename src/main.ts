import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ErrorException } from '@libs/filters/all-exceptions.filter';
import { ValidatePipe } from '@pipe/validate.pipe';
const bodyLimit = 10_485_760; // 10MiB

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
  //   rawBody: true,
  // });
  const adminWebOrigin = process.env.ADMIN_WEB_ORIGIN ?? 'http://localhost:3000';

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: adminWebOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // Thêm validation pipe
  app.useGlobalPipes(new ValidatePipe());

  // Thêm global exception filter
  app.useGlobalFilters(new ErrorException());

  // app.useBodyParser('json', { limit: '10mb' });

  // app.use(bodyParser.json({ limit: '10mb' }));
  // app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  const config = new DocumentBuilder()
    .setTitle('Rental Admin Dashboard API')
    .setDescription('Internal rental order management API')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`Application is running on: http://localhost:${port}/api`);
  Logger.log(`Swagger UI available at: http://localhost:${port}/api/docs`);
}
bootstrap();
