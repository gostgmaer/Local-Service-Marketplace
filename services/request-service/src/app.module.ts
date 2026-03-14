import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestModule } from './modules/request/request.module';
import { DatabaseModule } from './common/database/database.module';
import { LoggerModule } from './common/logger/logger.module';
import { KafkaModule } from './kafka/kafka.module';
import { RedisModule } from './redis/redis.module';
import { NotificationModule } from './common/notification/notification.module';
import { UserModule } from './common/user/user.module';
import { HealthController } from './common/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule,
    DatabaseModule,
    RedisModule,
    KafkaModule,
    NotificationModule,
    UserModule,
    RequestModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
