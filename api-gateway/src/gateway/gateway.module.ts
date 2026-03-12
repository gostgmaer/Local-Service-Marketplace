import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GatewayService } from './services/gateway.service';
import { GatewayController } from './controllers/gateway.controller';
import { HealthController } from './controllers/health.controller';
import { LoggingMiddleware } from './middlewares/logging.middleware';
import { JwtAuthMiddleware } from './middlewares/jwt-auth.middleware';
import { RateLimitMiddleware } from './middlewares/rate-limit.middleware';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [HealthController, GatewayController],
  providers: [GatewayService],
  exports: [GatewayService],
})
export class GatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply logging middleware to all routes
    consumer
      .apply(LoggingMiddleware)
      .forRoutes('*');

    // Apply JWT authentication middleware to all routes
    // Public routes are defined in publicRoutes (services.config.ts)
    consumer
      .apply(JwtAuthMiddleware)
      .forRoutes('*');

    // Apply rate limiting middleware to all routes
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes('*');
  }
}
