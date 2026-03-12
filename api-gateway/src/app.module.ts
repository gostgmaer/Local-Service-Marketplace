import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [LoggerModule, GatewayModule],
})
export class AppModule {}
