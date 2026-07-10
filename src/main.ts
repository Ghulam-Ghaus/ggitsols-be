import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:9001', 'http://127.0.0.1:9001'],
    credentials: true,
  });

  // Retrieve port dynamically using ConfigService
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 9000);

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
