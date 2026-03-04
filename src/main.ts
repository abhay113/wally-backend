import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './nestjs/app.module';
import { config } from './config';
import { AppExceptionFilter } from './nestjs/common/filters/app-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');

  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: config.isDevelopment ? '*' : process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());

  await app.listen(config.server.port, config.server.host);

  logger.log(`Server listening on ${config.server.host}:${config.server.port}`);
  logger.log(`Environment: ${config.env}`);
  logger.log(`Stellar Network: ${config.stellar.network}`);
}

bootstrap();
