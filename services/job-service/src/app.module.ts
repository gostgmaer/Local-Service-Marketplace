import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './common/database/database.module';
import { RedisModule } from './redis/redis.module';
import { KafkaModule } from './kafka/kafka.module';
import { NotificationModule } from './common/notification/notification.module';
import { UserModule } from './common/user/user.module';
import { JobModule } from './modules/job/job.module';
import { HealthController } from './common/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule,
    DatabaseModule,
    RedisModule,
    KafkaModule,
    NotificationModule,
    UserModule,
    JobModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
