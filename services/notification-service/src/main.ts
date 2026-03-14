import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get Winston logger
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global response transform interceptor
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter(logger));

  // CORS is handled by API Gateway - not needed in internal services

  const port = process.env.PORT || 3008;
  await app.listen(port);
  logger.log(`Notification service is running on port ${port}`, 'Bootstrap');
}
bootstrap();
