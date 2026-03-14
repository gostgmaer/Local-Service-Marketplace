import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './common/database/database.module';
import { RedisModule } from './redis/redis.module';
import { KafkaModule } from './kafka/kafka.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { HealthController } from './common/health/health.controller';

@Module({
  imports: [
    LoggerModule,
    DatabaseModule,
    RedisModule,
    KafkaModule,
    InfrastructureModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
