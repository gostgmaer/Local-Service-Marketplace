import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { GatewayModule } from './gateway/gateway.module';
import { HealthController } from './common/health/health.controller';

@Module({
  imports: [LoggerModule, GatewayModule],
  controllers: [HealthController],
})
export class AppModule {}
